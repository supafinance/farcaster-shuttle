import { HubEvent, extractEventTimestamp } from '@farcaster/hub-nodejs'
import type {
    Admin,
    Consumer,
    EachMessagePayload,
    Kafka,
    Producer,
} from 'kafkajs'
import type { Result } from 'neverthrow'
import type { pino } from 'pino'
import { log } from '../log'
import { statsd } from '../statsd'
import { inBatchesOf, sleep } from '../utils'
import type { HubClient } from './hub'
import type { ProcessResult } from './index'

/**
 * Represents a single connection to an event stream.
 *
 * Ideally you should have two connections per purpose: one for reading and one for writing.
 */
export class EventStreamConnection {
    private client: Kafka
    private producer: Producer | null = null
    private consumer: Consumer | null = null
    private admin: Admin | null = null

    constructor(client: Kafka) {
        this.client = client
    }

    async waitUntilReady() {
        // Kafka doesn't have a status method like Redis, so we can skip this
    }

    async createProducer() {
        if (!this.producer) {
            this.producer = this.client.producer()
            await this.producer.connect()
        }
        return this.producer
    }

    async createConsumer(groupId: string) {
        if (!this.consumer) {
            this.consumer = this.client.consumer({ groupId })
            await this.consumer.connect()
        }
        return this.consumer
    }

    async createAdmin() {
        if (!this.admin) {
            this.admin = this.client.admin()
            await this.admin.connect()
        }
        return this.admin
    }

    async add(key: string, data: Buffer | Buffer[]) {
        const producer = await this.createProducer()
        if (data instanceof Buffer) {
            await producer.send({
                topic: key,
                messages: [{ value: data }],
            })
        } else {
            const messages = data.map((buffer) => ({ value: buffer }))
            await producer.send({
                topic: key,
                messages,
            })
        }
    }

    async reserve(key: string, consumerGroup: string, count = 1) {
        const consumer = await this.createConsumer(consumerGroup)
        const messages: EachMessagePayload[] = []

        await consumer.subscribe({ topic: key, fromBeginning: false })
        await consumer.run({
            eachMessage: async (payload: EachMessagePayload) => {
                messages.push(payload)
                if (messages.length >= count) {
                    await consumer.pause([{ topic: key }])
                }
            },
        })

        // Wait for messages to be consumed
        await new Promise((resolve) => setTimeout(resolve, 5000))
        return messages.map(({ message }) => ({
            id: message.offset,
            data: message.value as Buffer,
        }))
    }

    async streamSize(key: string) {
        const admin = await this.createAdmin()
        const offsets = await admin.fetchTopicOffsets(key)
        const lowOffset = offsets[0].offset
        const highOffset = offsets[offsets.length - 1].offset
        return Number.parseInt(highOffset) - Number.parseInt(lowOffset)
    }
}

const GROUP_NAME = 'hub_events'
const MAX_EVENTS_PER_FETCH = 10
const MESSAGE_PROCESSING_CONCURRENCY = 10
const EVENT_PROCESSING_TIMEOUT = 10_000 // How long before retrying processing (millis)
const EVENT_DELETION_THRESHOLD = 1000 * 60 * 60 * 24 // 1 day

export type EventStreamConsumerOptions = {
    maxEventsPerFetch?: number
    messageProcessingConcurrency?: number
    groupName?: string
    eventProcessingTimeout?: number
    eventDeletionThreshold?: number
}

export class HubEventStreamConsumer {
    public hub: HubClient
    public readonly streamKey: string
    public readonly shardKey: string
    public readonly maxEventsPerFetch: number
    public readonly messageProcessingConcurrency: number
    public readonly eventProcessingTimeout: number
    public readonly eventDeletionThreshold: number
    public stopped = true
    public readonly groupName: string
    private stream: EventStreamConnection
    private log: pino.Logger

    constructor(
        hub: HubClient,
        eventStream: EventStreamConnection,
        shardKey: string,
        options: EventStreamConsumerOptions = {},
        logger: pino.Logger = log,
    ) {
        this.hub = hub
        this.stream = eventStream
        this.streamKey = `hub:${this.hub.host}:evt:msg:${shardKey}`
        this.groupName = options.groupName || GROUP_NAME
        this.maxEventsPerFetch =
            options.maxEventsPerFetch || MAX_EVENTS_PER_FETCH
        this.messageProcessingConcurrency =
            options.messageProcessingConcurrency ||
            MESSAGE_PROCESSING_CONCURRENCY
        this.eventProcessingTimeout =
            options.eventProcessingTimeout || EVENT_PROCESSING_TIMEOUT
        this.eventDeletionThreshold =
            options.eventDeletionThreshold || EVENT_DELETION_THRESHOLD
        this.shardKey = shardKey
        this.log = logger
    }

    async start(
        onEvent: (event: HubEvent) => Promise<Result<ProcessResult, Error>>,
    ) {
        this.stopped = false
        await this.stream.waitUntilReady()
        await this.stream.createGroup(this.streamKey, this.groupName)
        void this._runLoop(onEvent)
    }

    stop() {
        this.stopped = true
    }

    public async processStale(
        onEvent: (event: HubEvent) => Promise<Result<ProcessResult, Error>>,
    ) {
        const totalStaleProcessed = 0

        // Kafka doesn't have a direct equivalent for claiming stale messages,
        // so you might need to handle this with a separate consumer
        return totalStaleProcessed
    }

    public async clearOldEvents() {
        // Kafka doesn't support trimming by timestamp directly
        return 0
    }

    private async _runLoop(
        onEvent: (event: HubEvent) => Promise<Result<ProcessResult, Error>>,
    ) {
        while (!this.stopped) {
            try {
                const sizeStartTime = Date.now()
                const size = await this.stream.streamSize(this.streamKey)
                statsd.gauge('hub.event.stream.size', size, {
                    hub: this.hub.host,
                    source: this.shardKey,
                })
                const sizeTime = Date.now() - sizeStartTime

                statsd.timing('hub.event.stream.size_time', sizeTime, {
                    hub: this.hub.host,
                    source: this.shardKey,
                })
                let eventsRead = 0

                const startTime = Date.now()
                const events = await this.stream.reserve(
                    this.streamKey,
                    this.groupName,
                    this.maxEventsPerFetch,
                )
                const reserveTime = Date.now() - startTime

                statsd.timing('hub.event.stream.reserve_time', reserveTime, {
                    hub: this.hub.host,
                    source: this.shardKey,
                })
                statsd.increment('hub.event.stream.reserve', {
                    hub: this.hub.host,
                    source: this.shardKey,
                })

                eventsRead += events.length

                await inBatchesOf(
                    events,
                    this.messageProcessingConcurrency,
                    async (batchedEvents) => {
                        const eventIdsProcessed: string[] = []
                        await Promise.allSettled(
                            batchedEvents.map((event) =>
                                (async (streamEvent) => {
                                    try {
                                        const dequeueDelay =
                                            Date.now() -
                                            Number(streamEvent.id.split('-')[0])
                                        statsd.timing(
                                            'hub.event.stream.dequeue_delay',
                                            dequeueDelay,
                                            {
                                                hub: this.hub.host,
                                                source: this.shardKey,
                                            },
                                        )

                                        const startTime = Date.now()
                                        const hubEvent = HubEvent.decode(
                                            streamEvent.data,
                                        )
                                        const result = await onEvent(hubEvent)
                                        const processingTime =
                                            Date.now() - startTime
                                        statsd.timing(
                                            'hub.event.stream.time',
                                            processingTime,
                                            {
                                                hub: this.hub.host,
                                                source: this.shardKey,
                                                hubEventType:
                                                    hubEvent.type.toString(),
                                            },
                                        )
                                        if (result.isErr()) throw result.error

                                        if (result.value.skipped) {
                                            statsd.increment(
                                                'hub.event.stream.skipped',
                                                1,
                                                {
                                                    hub: this.hub.host,
                                                    source: this.shardKey,
                                                },
                                            )
                                        }
                                        eventIdsProcessed.push(streamEvent.id)

                                        if (!result.value.skipped) {
                                            const e2eTime =
                                                Date.now() -
                                                extractEventTimestamp(
                                                    hubEvent.id,
                                                )
                                            statsd.timing(
                                                'hub.event.stream.e2e_time',
                                                e2eTime,
                                                {
                                                    hub: this.hub.host,
                                                    source: this.shardKey,
                                                    hubEventType:
                                                        hubEvent.type.toString(),
                                                },
                                            )
                                        }
                                    } catch (e: unknown) {
                                        statsd.increment(
                                            'hub.event.stream.errors',
                                            {
                                                hub: this.hub.host,
                                                source: this.shardKey,
                                            },
                                        )
                                        this.log.error(e) // Report and move on to next event
                                    }
                                })(event),
                            ),
                        )

                        if (eventIdsProcessed.length) {
                            const startTime = Date.now()
                            await this.stream.ack(
                                this.streamKey,
                                this.groupName,
                                eventIdsProcessed,
                            )
                            statsd.timing(
                                'hub.event.stream.ack_time',
                                Date.now() - startTime,
                                {
                                    hub: this.hub.host,
                                    source: this.shardKey,
                                },
                            )

                            statsd.increment(
                                'hub.event.stream.ack',
                                eventIdsProcessed.length,
                                {
                                    hub: this.hub.host,
                                    source: this.shardKey,
                                },
                            )
                        }
                    },
                )

                if (eventsRead === 0) {
                    if (this.stopped) break
                    const numProcessed = await this.processStale(onEvent)
                    const numCleared = await this.clearOldEvents()
                    if (numProcessed + numCleared === 0) await sleep(10) // No events, so wait a bit to prevent CPU thrash
                }
            } catch (e: unknown) {
                this.log.error(e, 'Error processing event, skipping')
            }
        }
    }
}
