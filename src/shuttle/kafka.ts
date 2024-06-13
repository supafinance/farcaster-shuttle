import { Kafka } from 'kafkajs'
import {
    KAFKA_ENDPOINT,
    UPSTASH_KAFKA_PASSWORD,
    UPSTASH_KAFKA_USERNAME,
} from '../env.ts'

export const kafka = new Kafka({
    brokers: [KAFKA_ENDPOINT],
    sasl: {
        mechanism: 'scram-sha-512',
        username: UPSTASH_KAFKA_USERNAME,
        password: UPSTASH_KAFKA_PASSWORD,
    },
    ssl: true,
})

export class KafkaClient {
    public client: Kafka
    constructor(client: Kafka) {
        this.client = client
    }

    static create() {
        return new KafkaClient(kafka)
    }

    async createProducer() {
        return this.client.producer()
    }

    async createConsumer(groupId: string) {
        return this.client.consumer({ groupId })
    }

    async createAdmin() {
        return this.client.admin()
    }

    async createTopic(topic: string) {
        const admin = await this.createAdmin()
        await admin.createTopics({
            topics: [{ topic }],
        })
    }

    async deleteTopic(topic: string) {
        const admin = await this.createAdmin()
        await admin.deleteTopics({
            topics: [topic],
        })
    }
}
