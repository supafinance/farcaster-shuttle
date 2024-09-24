import * as process from 'node:process'
import url from 'node:url'
import {Command} from '@commander-js/extra-typings'
import {type HubEvent, type Message, MessageType} from '@farcaster/hub-nodejs'
import type {Queue} from 'bullmq'
import type {PostgresJsTransaction} from 'drizzle-orm/postgres-js'
import {ok} from 'neverthrow'
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
import {log} from './log.ts'
import {deleteLinks, insertLinks} from './processors/link.ts'
import {deleteReactions, insertReactions} from './processors/reaction.ts'
import {insertUserDatas} from './processors/userData.ts'
import {deleteVerifications, insertVerifications,} from './processors/verification.ts'
import {
    EventStreamConnection,
    EventStreamHubSubscriber,
    getHubClient,
    HubEventStreamConsumer,
    type HubSubscriber,
    type MessageHandler,
    processHubEvent,
    processMessages,
    reconcileMessagesForFid,
    RedisClient,
} from './shuttle'
import {getQueue, getWorker} from './worker.ts'

const hubId = 'shuttle'

/**
 * Class that represents the shuttle application
 */
export class App implements MessageHandler {
    public redis: RedisClient
    private hubSubscriber: HubSubscriber
    private streamConsumer: HubEventStreamConsumer
    private readonly hubId

    constructor({
        redis,
        hubSubscriber,
        streamConsumer,
    }: {
        redis: RedisClient
        hubSubscriber: HubSubscriber
        streamConsumer: HubEventStreamConsumer
    }) {
        this.redis = redis
        this.hubSubscriber = hubSubscriber
        this.hubId = hubId
        this.streamConsumer = streamConsumer
    }

    static create() {
        const redisUrl = REDIS_URL
        const hubUrl = HUB_HOST
        const totalShards = TOTAL_SHARDS
        const shardIndex = SHARD_INDEX
        const hubSSL = HUB_SSL ?? false

        // creates a hub rpc client
        const hub = getHubClient(hubUrl, { ssl: hubSSL })
        const redis = RedisClient.create({ redisUrl })
        const eventStreamForWrite = new EventStreamConnection(redis.client)
        const eventStreamForRead = new EventStreamConnection(redis.client)
        const shardKey = totalShards === 0 ? 'all' : `${shardIndex}`
        const hubSubscriber = new EventStreamHubSubscriber({
            label: hubId,
            hubClient: hub,
            eventStream: eventStreamForWrite,
            redis,
            shardKey,
            log,
            eventTypes: undefined,
            totalShards,
            shardIndex,
        })
        const streamConsumer = new HubEventStreamConsumer({
            hub,
            eventStream: eventStreamForRead,
            shardKey,
        })

        return new App({ redis, hubSubscriber, streamConsumer })
    }

    /**
     * Process messages of a given type
     * @param {object} args - The arguments object.
     * @param {Message[]} args.messages - The messages to process.
     * @param {MessageType} args.type - The type of message to process.
     * @param {PostgresJsTransaction} args.trx - The database transaction.
     */
    static async processMessagesOfType({
        messages,
        type,
        trx,
    }: {
        messages: Message[]
        type: MessageType
        trx: PostgresJsTransaction<any, any>
    }): Promise<void> {
        switch (type) {
            // case MessageType.CAST_ADD:
            //     await insertCasts({ msgs: messages, trx })
            //     break
            // case MessageType.CAST_REMOVE:
            //     await deleteCasts({ msgs: messages, trx })
            //     break
            case MessageType.REACTION_ADD:
                await insertReactions({
                    msgs: messages,
                    trx,
                })
                break
            case MessageType.REACTION_REMOVE:
                await deleteReactions({
                    msgs: messages,
                    trx,
                })
                break
            case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
                await insertVerifications({
                    msgs: messages,
                    trx,
                })
                break
            case MessageType.VERIFICATION_REMOVE:
                await deleteVerifications({
                    msgs: messages,
                    trx,
                })
                break
            case MessageType.USER_DATA_ADD:
                await insertUserDatas({
                    msgs: messages,
                    trx,
                })
                break
            case MessageType.LINK_ADD:
                await insertLinks({
                    msgs: messages,
                    trx,
                })
                break
            case MessageType.LINK_REMOVE:
                await deleteLinks({
                    msgs: messages,
                    trx,
                })
                break
            default:
                log.debug(`No handler for message type ${type}`)
        }
    }

    async handleMessageMerge({
        message,
        trx,
    }: {
        message: Message
        trx: PostgresJsTransaction<any, any>
    }): Promise<void> {
        if (message.data?.type) {
            await App.processMessagesOfType({
                messages: [message],
                type: message.data.type,
                trx,
            })
        }
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

        for (const fid of fids) {
            await reconcileMessagesForFid({
                client: this.hubSubscriber.hubClient,
                log,
                fid,
                onHubMessage: async (messages, type) => {
                    await processMessages({
                        messages,
                        type,
                    })
                },
            })
        }
    }

    async backfillFids({
        fids,
        backfillQueue,
    }: { fids: number[]; backfillQueue: Queue }) {
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
        await processHubEvent(hubEvent, this)
    }
}

//If the module is being run directly, start the shuttle
if (
    import.meta.url.endsWith(
        url.pathToFileURL(process.argv[1] || '').toString(),
    )
) {
    console.log('Running shuttle through CLI')
    /**
     * Starts the shuttle listening to current events from the hub
     */
    async function start() {
        log.info(
            `Creating app connecting to: ${POSTGRES_URL}, ${REDIS_URL}, ${HUB_HOST}`,
        )
        const app = App.create()
        log.info('Starting shuttle')
        await app.start()
        // Keep the process running
        await new Promise(() => {})
    }

    /**
     * Queues up backfill for the worker
     */
    async function backfill() {
        log.info(
            `Creating app connecting to: ${POSTGRES_URL}, ${REDIS_URL}, ${HUB_HOST}`,
        )
        const app = App.create()
        const fids = BACKFILL_FIDS
            ? BACKFILL_FIDS.split(',').map((fid) => Number.parseInt(fid))
            : []
        log.info(`Backfilling fids: ${fids}`)

        // clear redis db
        await app.redis.client.flushdb()

        const backfillQueue = getQueue(app.redis.client)
        await app.backfillFids({ fids, backfillQueue })

        // set last processed event id to 0
        await app.redis.setLastProcessedEvent({ hubId, eventId: 0 })

        // Start the worker after initiating a backfill
        const worker = getWorker(app, app.redis.client, log, CONCURRENCY)
        await worker.run()
        // Keep the process running
        await new Promise(() => {})
    }

    /**
     * Starts the backfill worker
     */
    async function worker() {
        log.info(
            `Starting worker connecting to: ${POSTGRES_URL}, ${REDIS_URL}, ${HUB_HOST}`,
        )
        const app = App.create()
        const worker = getWorker(app, app.redis.client, log, CONCURRENCY)
        await worker.run()
        // Keep the process running
    await new Promise(() => {})
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
