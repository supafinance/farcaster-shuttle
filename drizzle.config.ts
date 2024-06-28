import type { Config } from 'drizzle-kit'

export default {
    dialect: 'postgresql',
    schema: './src/lib/drizzle/schema.ts',
    out: './src/lib/drizzle/migrations',
    connectionString: process.env.POSTGRES_URL!,
    breakpoints: true,
} as Config
