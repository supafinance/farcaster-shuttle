import * as process from 'node:process'
import url from 'node:url'
// import { Command } from 'commander'
import { Command } from '@commander-js/extra-typings'
import {
    type HubEvent,
    type Message,
    MessageType,
    bytesToHexString,
} from '@farcaster/hub-nodejs'
import type { Queue } from 'bullmq'
import { ok } from 'neverthrow'
import { type AppDb, migrateToLatest } from './db.ts'
import {
    BACKFILL_FIDS,
    CONCURRENCY,
    HUB_HOST,
    HUB_SSL,
    MAX_FID,
    POSTGRES_URL,
    REDIS_URL,
    SHARD_INDEX,
    TOTAL_SHARDS,
} from './env.ts'
import { log } from './log.ts'
import { deleteLinks, insertLinks } from './processors/link.ts'
import { deleteReactions, insertReactions } from './processors/reaction.ts'
import { insertUserDatas } from './processors/userData.ts'
import {
    deleteVerifications,
    insertVerifications,
} from './processors/verification.ts'
import {
    type DB,
    EventStreamConnection,
    EventStreamHubSubscriber,
    HubEventProcessor,
    HubEventStreamConsumer,
    type HubSubscriber,
    type MessageHandler,
    MessageReconciliation,
    type MessageState,
    RedisClient,
    type StoreMessageOperation,
    getDbClient,
    getHubClient,
} from './shuttle'
import { getQueue, getWorker } from './worker.ts'

const hubId = 'shuttle'

export class App implements MessageHandler {
    public redis: RedisClient
    private readonly db: DB
    private hubSubscriber: HubSubscriber
    private streamConsumer: HubEventStreamConsumer
    private readonly hubId

    constructor(
        db: DB,
        redis: RedisClient,
        hubSubscriber: HubSubscriber,
        streamConsumer: HubEventStreamConsumer,
    ) {
        this.db = db
        this.redis = redis
        this.hubSubscriber = hubSubscriber
        this.hubId = hubId
        this.streamConsumer = streamConsumer
    }

    static create(
        dbUrl: string,
        redisUrl: string,
        hubUrl: string,
        totalShards: number,
        shardIndex: number,
        hubSSL = false,
    ) {
        const db = getDbClient(dbUrl)
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

        return new App(db, redis, hubSubscriber, streamConsumer)
    }

    static async processMessagesOfType(
        messages: Message[],
        type: MessageType,
        db: AppDb,
    ): Promise<void> {
        switch (type) {
            // case MessageType.CAST_ADD:
            //     await insertCasts(messages, db)
            //     break
            // case MessageType.CAST_REMOVE:
            //     await deleteCasts(messages, db)
            //     break
            case MessageType.REACTION_ADD:
                await insertReactions(messages, db)
                break
            case MessageType.REACTION_REMOVE:
                await deleteReactions(messages, db)
                break
            case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
                await insertVerifications({ msgs: messages, db })
                break
            case MessageType.VERIFICATION_REMOVE:
                await deleteVerifications({ msgs: messages, db })
                break
            case MessageType.USER_DATA_ADD:
                await insertUserDatas({ msgs: messages, db })
                break
            case MessageType.LINK_ADD:
                await insertLinks({ msgs: messages, db })
                break
            case MessageType.LINK_REMOVE:
                await deleteLinks({ msgs: messages, db })
                break
            default:
                log.debug(`No handler for message type ${type}`)
        }
    }

    // todo: checkout christopher's implementation
    async handleMessageMerge(
        message: Message,
        txn: DB,
        operation: StoreMessageOperation,
        state: MessageState,
        isNew: boolean,
        wasMissed: boolean,
    ): Promise<void> {
        if (!isNew) {
            // Message was already in the db, no-op
            return
        }

        const appDB = txn as unknown as AppDb // Need this to make typescript happy, not clean way to "inherit" table types

        if (message.data?.type) {
            await App.processMessagesOfType([message], message.data.type, appDB)
        }

        const messageDesc = wasMissed
            ? `missed message (${operation})`
            : `message (${operation})`
        log.info(
            `${state} ${messageDesc} ${bytesToHexString(
                message.hash,
            )._unsafeUnwrap()} (type ${message.data?.type})`,
        )
    }

    async start() {
        await this.ensureMigrations()
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
            this.db,
            log,
        )
        for (const fid of fids) {
            await reconciler.reconcileMessagesForFid(
                fid,
                async (message, missingInDb, prunedInDb, revokedInDb) => {
                    if (missingInDb) {
                        await HubEventProcessor.handleMissingMessage(
                            this.db,
                            message,
                            this,
                        )
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
        await this.ensureMigrations()
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
            const batchSize = 20
            const fids = Array.from(
                { length: Math.ceil(maxFid / batchSize) },
                (_, i) => i * batchSize,
            ).map((fid) => fid + 1)
            for (const start of fids) {
                const subset = Array.from(
                    { length: batchSize },
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

    async ensureMigrations() {
        const result = await migrateToLatest(this.db, log)
        if (result.isErr()) {
            log.error('Failed to migrate database', result.error)
            throw result.error
        }
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
        await HubEventProcessor.processHubEvent(this.db, hubEvent, this)
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
            POSTGRES_URL,
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
            POSTGRES_URL,
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
            POSTGRES_URL,
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
