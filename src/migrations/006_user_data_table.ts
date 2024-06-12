import { type Kysely, sql } from 'kysely'

interface Database {
    userData: {
        fid: bigint
        createdAt: string
        updatedAt: string
        timestamp: string
        deletedAt?: string
        pfp?: string
        pfpUpdatedAt?: string
        username?: string
        usernameUpdatedAt?: string
        displayName?: string
        displayNameUpdatedAt?: string
        bio?: string
        bioUpdatedAt?: string
        url?: string
        urlUpdatedAt?: string
    }
}

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable('userData')
        .addColumn('fid', 'decimal(12, 0)', (col) => col.primaryKey())
        .addColumn('createdAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('updatedAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('timestamp', 'timestamptz', (col) => col.notNull())
        .addColumn('deletedAt', 'timestamptz')
        .addColumn('pfp', 'text', (col) => col)
        .addColumn('pfpUpdatedAt', 'timestamptz', (col) => col)
        .addColumn('username', 'text', (col) => col.unique())
        .addColumn('usernameUpdatedAt', 'timestamptz', (col) => col)
        .addColumn('displayName', 'text', (col) => col)
        .addColumn('displayNameUpdatedAt', 'timestamptz', (col) => col)
        .addColumn('bio', 'text', (col) => col)
        .addColumn('bioUpdatedAt', 'timestamptz', (col) => col)
        .addColumn('url', 'text', (col) => col)
        .addColumn('urlUpdatedAt', 'timestamptz', (col) => col)
        .execute()
}
