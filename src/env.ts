import 'dotenv/config'

export const COLORIZE =
    process.env.COLORIZE === 'true'
        ? true
        : process.env.COLORIZE === 'false'
          ? false
          : process.stdout.isTTY
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

export const HUB_HOST = process.env.HUB_HOST || 'localhost:2283'
export const HUB_SSL = process.env.HUB_SSL === 'true'

export const POSTGRES_URL =
    process.env.POSTGRES_URL || 'postgres://localhost:5432'
export const KAFKA_ENDPOINT = process.env.KAFKA_ENDPOINT || 'localhost:9092'
export const UPSTASH_KAFKA_USERNAME = process.env.UPSTASH_KAFKA_USERNAME || ''
export const UPSTASH_KAFKA_PASSWORD = process.env.UPSTASH_KAFKA_PASSWORD || ''

export const TOTAL_SHARDS = Number.parseInt(process.env.SHARDS || '0')
export const SHARD_INDEX = Number.parseInt(process.env.SHARD_NUM || '0')

export const BACKFILL_FIDS = process.env.FIDS || ''
export const MAX_FID = process.env.MAX_FID

export const STATSD_HOST = process.env.STATSD_HOST
export const STATSD_METRICS_PREFIX =
    process.env.STATSD_METRICS_PREFIX || 'shuttle.'

export const CONCURRENCY = Number.parseInt(process.env.CONCURRENCY || '2')
