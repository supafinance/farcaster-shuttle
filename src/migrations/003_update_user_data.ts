import type { Kysely } from 'kysely'

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
        .alterTable('userData')
        .addColumn('pfp', 'text')
        .addColumn('pfpUpdatedAt', 'timestamptz')
        .addColumn('username', 'text', (col) => col.unique())
        .addColumn('usernameUpdatedAt', 'timestamptz')
        .addColumn('displayName', 'text')
        .addColumn('displayNameUpdatedAt', 'timestamptz')
        .addColumn('bio', 'text')
        .addColumn('bioUpdatedAt', 'timestamptz')
        .addColumn('url', 'text')
        .addColumn('urlUpdatedAt', 'timestamptz')
        .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable('userData')
        .dropColumn('timestamp')
        .dropColumn('deletedAt')
        .dropColumn('pfp')
        .dropColumn('pfpUpdatedAt')
        .dropColumn('username')
        .dropColumn('usernameUpdatedAt')
        .dropColumn('displayName')
        .dropColumn('displayNameUpdatedAt')
        .dropColumn('bio')
        .dropColumn('bioUpdatedAt')
        .dropColumn('url')
        .dropColumn('urlUpdatedAt')
        .execute()
}
