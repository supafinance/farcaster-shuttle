import { Redis, type RedisOptions } from 'ioredis'

/**
 * Get a Redis client.
 * @param {string} redisUrl The URL of the Redis instance.
 * @param {RedisOptions} redisOpts The options for the Redis client.
 * @returns {Redis} The Redis client.
 */
export const getRedisClient = ({
    redisUrl,
    redisOpts,
}: { redisUrl: string; redisOpts?: RedisOptions }) => {
    const client = new Redis(redisUrl, {
        connectTimeout: 5_000,
        maxRetriesPerRequest: null, // BullMQ wants this set
        ...redisOpts,
    })
    return client
}

export class RedisClient {
    public client: Redis
    constructor(client: Redis) {
        this.client = client
    }

    /**
     * Create a new RedisClient
     * @param {string} redisUrl The URL of the Redis instance.
     * @param {RedisOptions} redisOpts The options for the Redis client.
     */
    static create({
        redisUrl,
        redisOpts,
    }: { redisUrl: string; redisOpts?: RedisOptions }) {
        const client = getRedisClient({ redisUrl, redisOpts })
        return new RedisClient(client)
    }

    /**
     * Set the last processed event ID for a hub.
     * @param {string} hubId The ID of the hub.
     * @param {number} eventId The ID of the event.
     */
    async setLastProcessedEvent({
        hubId,
        eventId,
    }: { hubId: string; eventId: number }) {
        const key = `hub:${hubId}:last-hub-event-id`
        if (eventId === 0) {
            await this.client.del(key)
        } else {
            await this.client.set(key, eventId.toString())
        }
    }

    /**
     * Get the last processed event ID for a hub.
     * @param {string} hubId The ID of the hub.
     * @returns {Promise<number>} The last processed event ID.
     */
    async getLastProcessedEvent(hubId: string) {
        const eventId = await this.client.get(`hub:${hubId}:last-hub-event-id`)
        return eventId ? Number.parseInt(eventId) : 0
    }

    async clearForTest() {
        await this.client.flushdb()
    }
}
