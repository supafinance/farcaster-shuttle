import { type Kysely, sql } from 'kysely'

// biome-ignore lint/suspicious/noExplicitAny: legacy code, avoid using ignore for new code
export const up = async (db: Kysely<any>) => {
    // FIDS
    await db.schema
        .createTable('fids')
        .addColumn('fid', 'bigint', (col) => col.primaryKey())
        .addColumn('createdAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('updatedAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('registeredAt', 'timestamptz', (col) => col.notNull())
        .addColumn('custodyAddress', 'bytea', (col) => col.notNull())
        .addColumn('recoveryAddress', 'bytea', (col) => col.notNull())
        .execute()

    // FNAMES
    await db.schema
        .createTable('fnames')
        .addColumn('id', 'uuid', (col) =>
            col.defaultTo(sql`generate_ulid()`).primaryKey(),
        )
        .addColumn('createdAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('updatedAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('registeredAt', 'timestamptz', (col) => col.notNull())
        .addColumn('deletedAt', 'timestamptz')
        .addColumn('fid', 'bigint', (col) => col.notNull())
        .addColumn('type', sql`smallint`, (col) => col.notNull())
        .addColumn('username', 'text', (col) => col.notNull())
        .addUniqueConstraint('fnames_fid_unique', ['fid'])
        .addUniqueConstraint('fnames_username_unique', ['username'])
        .execute()

    // LINKS
    await db.schema
        .createTable('links')
        .addColumn('id', 'uuid', (col) =>
            col.defaultTo(sql`generate_ulid()`).primaryKey(),
        )
        .addColumn('createdAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('updatedAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('timestamp', 'timestamptz', (col) => col.notNull())
        .addColumn('deletedAt', 'timestamptz')
        .addColumn('fid', 'bigint', (col) => col.notNull())
        .addColumn('targetFid', 'bigint', (col) => col.notNull())
        .addColumn('displayTimestamp', 'timestamptz')
        .addColumn('type', 'text', (col) => col.notNull())
        .addColumn('hash', 'bytea', (col) => col.notNull().unique())
        .execute()

    // VERIFICATIONS
    await db.schema
        .createTable('verifications')
        .addColumn('id', 'uuid', (col) =>
            col.defaultTo(sql`generate_ulid()`).primaryKey(),
        )
        .addColumn('createdAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('updatedAt', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`current_timestamp`),
        )
        .addColumn('timestamp', 'timestamptz', (col) => col.notNull())
        .addColumn('deletedAt', 'timestamptz')
        .addColumn('fid', 'bigint', (col) => col.notNull())
        .addColumn('hash', 'bytea', (col) => col.notNull())
        .addColumn('signerAddress', 'bytea', (col) => col.notNull())
        .addColumn('blockHash', 'bytea', (col) => col.notNull())
        .addColumn('signature', 'bytea', (col) => col.notNull())
        .addUniqueConstraint('verifications_signer_address_fid_unique', [
            'signerAddress',
            'fid',
        ])
        .execute()

    await db.schema
        .createIndex('verifications_fid_timestamp_index')
        .on('verifications')
        .columns(['fid', 'timestamp'])
        .execute()

    // USER DATA
    await db.schema
        .createTable('userData')
        .addColumn('fid', 'bigint', (col) => col.primaryKey())
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

    // Events
    await db.schema
        .createTable('events')
        .addColumn('id', 'int8', (col) => col.primaryKey())
        .execute()
}

// biome-ignore lint/suspicious/noExplicitAny: TODO: remove any
export const down = async (db: Kysely<any>) => {
    // Delete in reverse order of above so that foreign keys are not violated.
    await db.schema.dropTable('userData').ifExists().execute()
    await db.schema.dropTable('verifications').ifExists().execute()
    await db.schema.dropTable('links').ifExists().execute()
    await db.schema.dropTable('fnames').ifExists().execute()
    await db.schema.dropTable('fids').ifExists().execute()
}
