import type { Config } from 'drizzle-kit'

export default {
    dialect: 'postgresql',
    schema: './lib/drizzle/schema.ts',
    out: './lib/drizzle/migrations',
    connectionString: process.env.POSTGRES_URL!,
    breakpoints: true,
} as Config
