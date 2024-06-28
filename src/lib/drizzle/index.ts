import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { MAX_CONNECTIONS } from '../../env.ts'
import * as schema from './schema'

const connectionString = process.env.POSTGRES_URL!

const client = postgres(connectionString, {
    prepare: false,
    max: MAX_CONNECTIONS,
})

export const db = drizzle(client, { schema })
