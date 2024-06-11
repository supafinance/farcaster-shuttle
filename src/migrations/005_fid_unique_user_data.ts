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
        .addUniqueConstraint('userData_fid_unique', ['fid'])
        .execute()
}
