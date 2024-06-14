import * as process from 'node:process'
import url from 'node:url'
import { Command } from '@commander-js/extra-typings'
import {
    type HubEvent,
    type Message,
    MessageType,
    bytesToHexString,
} from '@farcaster/hub-nodejs'
import type { Queue } from 'bullmq'
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import { ok } from 'neverthrow'
import {
    BACKFILL_FIDS,
    BATCH_SIZE,
    CONCURRENCY,
    HUB_HOST,
    HUB_SSL,
    MAX_FID,
    POSTGRES_URL,
    REDIS_URL,
    SHARD_INDEX,
    TOTAL_SHARDS,
} from './env.ts'
import { db } from './lib/drizzle'
import { log } from './log.ts'
import { deleteLinks, insertLinks } from './processors/link.ts'
import { deleteReactions, insertReactions } from './processors/reaction.ts'
import { insertUserDatas } from './processors/userData.ts'
import {
    deleteVerifications,
    insertVerifications,
} from './processors/verification.ts'
import {
    EventStreamConnection,
    EventStreamHubSubscriber,
    HubEventStreamConsumer,
    type HubSubscriber,
    type MessageHandler,
    MessageReconciliation,
    type MessageState,
    RedisClient,
    type StoreMessageOperation,
    getHubClient,
    handleMissingMessage,
    processHubEvent,
} from './shuttle'
import { getQueue, getWorker } from './worker.ts'

const hubId = 'shuttle'

export class App implements MessageHandler {
    public redis: RedisClient
    private hubSubscriber: HubSubscriber
    private streamConsumer: HubEventStreamConsumer
    private readonly hubId

    constructor(
        redis: RedisClient,
        hubSubscriber: HubSubscriber,
        streamConsumer: HubEventStreamConsumer,
    ) {
        this.redis = redis
        this.hubSubscriber = hubSubscriber
        this.hubId = hubId
        this.streamConsumer = streamConsumer
    }

    static create(
        redisUrl: string,
        hubUrl: string,
        totalShards: number,
        shardIndex: number,
        hubSSL = false,
    ) {
        // creates a hub rpc client
        const hub = getHubClient(hubUrl, { ssl: hubSSL })
        const redis = RedisClient.create(redisUrl)
        const eventStreamForWrite = new EventStreamConnection(redis.client)
        const eventStreamForRead = new EventStreamConnection(redis.client)
        const shardKey = totalShards === 0 ? 'all' : `${shardIndex}`
        const hubSubscriber = new EventStreamHubSubscriber(
            hubId,
            hub,
            eventStreamForWrite,
            redis,
            shardKey,
            log,
            undefined,
            totalShards,
            shardIndex,
        )
        const streamConsumer = new HubEventStreamConsumer(
            hub,
            eventStreamForRead,
            shardKey,
        )

        return new App(redis, hubSubscriber, streamConsumer)
    }

    static async processMessagesOfType(
        messages: Message[],
        type: MessageType,
        txn: PostgresJsTransaction<any, any>,
    ): Promise<void> {
        switch (type) {
            // case MessageType.CAST_ADD:
            //     await insertCasts(messages, db)
            //     break
            // case MessageType.CAST_REMOVE:
            //     await deleteCasts(messages, db)
            //     break
            case MessageType.REACTION_ADD:
                await insertReactions({
                    msgs: messages,
                    txn,
                })
                break
            case MessageType.REACTION_REMOVE:
                await deleteReactions({
                    msgs: messages,
                    txn,
                })
                break
            case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
                await insertVerifications({
                    msgs: messages,
                    txn,
                })
                break
            case MessageType.VERIFICATION_REMOVE:
                await deleteVerifications({
                    msgs: messages,
                    txn,
                })
                break
            case MessageType.USER_DATA_ADD:
                await insertUserDatas({
                    msgs: messages,
                    txn,
                })
                break
            case MessageType.LINK_ADD:
                await insertLinks({
                    msgs: messages,
                    txn,
                })
                break
            case MessageType.LINK_REMOVE:
                await deleteLinks({
                    msgs: messages,
                    txn,
                })
                break
            default:
                log.debug(`No handler for message type ${type}`)
        }
    }

    // todo: checkout christopher's implementation
    async handleMessageMerge({
        message,
        txn,
        operation,
        state,
        wasMissed,
    }: {
        message: Message
        txn: PostgresJsTransaction<any, any>
        operation: StoreMessageOperation
        state: MessageState
        wasMissed: boolean
    }): Promise<void> {
        if (message.data?.type) {
            await App.processMessagesOfType([message], message.data.type, txn)
        }

        const messageDesc = wasMissed
            ? `missed message (${operation})`
            : `message (${operation})`
        log.debug(
            `${state} ${messageDesc} ${bytesToHexString(
                message.hash,
            )._unsafeUnwrap()} (type ${message.data?.type})`,
        )
    }

    async start() {
        // Hub subscriber listens to events from the hub and writes them to a redis stream. This allows for scaling by
        // splitting events to multiple streams
        await this.hubSubscriber.start()

        // Sleep 10 seconds to give the subscriber a chance to create the stream for the first time.
        await new Promise((resolve) => setTimeout(resolve, 10_000))

        log.info('Starting stream consumer')
        // Stream consumer reads from the redis stream and inserts them into postgres
        await this.streamConsumer.start(async (event) => {
            void this.processHubEvent(event)
            return ok({ skipped: false })
        })
    }

    async reconcileFids(fids: number[]) {
        if (!this.hubSubscriber.hubClient) {
            log.error('Hub client is not initialized')
            throw new Error('Hub client is not initialized')
        }

        const reconciler = new MessageReconciliation(
            this.hubSubscriber.hubClient,
            db,
            log,
        )
        for (const fid of fids) {
            await reconciler.reconcileMessagesForFid(
                fid,
                async (message, missingInDb, prunedInDb, revokedInDb) => {
                    if (missingInDb) {
                        await handleMissingMessage(db, message, this)
                    } else if (prunedInDb || revokedInDb) {
                        const messageDesc = prunedInDb
                            ? 'pruned'
                            : revokedInDb
                              ? 'revoked'
                              : 'existing'
                        log.info(
                            `Reconciled ${messageDesc} message ${bytesToHexString(
                                message.hash,
                            )._unsafeUnwrap()}`,
                        )
                    }
                },
            )
        }
    }

    async backfillFids(fids: number[], backfillQueue: Queue) {
        const startedAt = Date.now()
        if (fids.length === 0) {
            const maxFidResult = await this.hubSubscriber.hubClient?.getFids({
                pageSize: 1,
                reverse: true,
            })
            log.debug('maxFidResult:', maxFidResult)
            if (maxFidResult === undefined) {
                log.error('Hub client is not initialized')
                throw new Error('Hub client is not initialized')
            }

            if (maxFidResult.isErr()) {
                log.error('Failed to get max fid', maxFidResult.error)
                throw maxFidResult.error
            }
            const maxFid = MAX_FID
                ? Number.parseInt(MAX_FID)
                : maxFidResult.value.fids[0]
            if (!maxFid) {
                log.error('Max fid was undefined')
                throw new Error('Max fid was undefined')
            }
            log.debug(`Queuing up fids upto: ${maxFid}`)
            // create an array of arrays in batches of 100 upto maxFid
            const fids = Array.from(
                { length: Math.ceil(maxFid / BATCH_SIZE) },
                (_, i) => i * BATCH_SIZE,
            ).map((fid) => fid + 1)
            for (const start of fids) {
                const subset = Array.from(
                    { length: BATCH_SIZE },
                    (_, i) => start + i,
                )
                await backfillQueue.add('reconcile', { fids: subset })
            }
        } else {
            await backfillQueue.add('reconcile', { fids })
        }
        await backfillQueue.add('completionMarker', { startedAt })
        log.info('Backfill jobs queued')
    }

    async stop() {
        this.hubSubscriber.stop()
        try {
            const lastEventId = await this.redis.getLastProcessedEvent(
                this.hubId,
            )
            log.info(`Stopped at eventId: ${lastEventId}`)
        } catch (e) {
            log.error(e)
        }
    }

    private async processHubEvent(hubEvent: HubEvent) {
        await processHubEvent(db, hubEvent, this)
    }
}

//If the module is being run directly, start the shuttle
if (
    import.meta.url.endsWith(
        url.pathToFileURL(process.argv[1] || '').toString(),
    )
) {
    async function start() {
        log.info(
            `Creating app connecting to: ${POSTGRES_URL}, ${REDIS_URL}, ${HUB_HOST}`,
        )
        const app = App.create(
            REDIS_URL,
            HUB_HOST,
            TOTAL_SHARDS,
            SHARD_INDEX,
            HUB_SSL,
        )
        log.info('Starting shuttle')
        await app.start()
    }

    async function backfill() {
        log.info(
            `Creating app connecting to: ${POSTGRES_URL}, ${REDIS_URL}, ${HUB_HOST}`,
        )
        const app = App.create(
            REDIS_URL,
            HUB_HOST,
            TOTAL_SHARDS,
            SHARD_INDEX,
            HUB_SSL,
        )
        const fids = BACKFILL_FIDS
            ? BACKFILL_FIDS.split(',').map((fid) => Number.parseInt(fid))
            : []
        log.info(`Backfilling fids: ${fids}`)
        const backfillQueue = getQueue(app.redis.client)
        await app.backfillFids(fids, backfillQueue)

        // Start the worker after initiating a backfill
        const worker = getWorker(app, app.redis.client, log, CONCURRENCY)
        await worker.run()
        return
    }

    async function worker() {
        log.info(
            `Starting worker connecting to: ${POSTGRES_URL}, ${REDIS_URL}, ${HUB_HOST}`,
        )
        const app = App.create(
            REDIS_URL,
            HUB_HOST,
            TOTAL_SHARDS,
            SHARD_INDEX,
            HUB_SSL,
        )
        const worker = getWorker(app, app.redis.client, log, CONCURRENCY)
        await worker.run()
    }

    const program = new Command()
        .name('shuttle')
        .description('Synchronizes a Farcaster Hub with a Postgres database')
        .version('0.0.1')

    program.command('start').description('Starts the shuttle').action(start)
    program
        .command('backfill')
        .description('Queue up backfill for the worker')
        .action(backfill)
    program
        .command('worker')
        .description('Starts the backfill worker')
        .action(worker)
    program.parse(process.argv)
}
