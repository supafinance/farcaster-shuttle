// CASTS
import { type Kysely, sql } from 'kysely'

// biome-ignore lint/suspicious/noExplicitAny: legacy code, avoid using ignore for new code
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable('casts')
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
        .addColumn('parentFid', 'bigint')
        .addColumn('hash', 'bytea', (col) => col.notNull().unique())
        .addColumn('rootParentHash', 'bytea')
        .addColumn('parentHash', 'bytea')
        .addColumn('rootParentUrl', 'text')
        .addColumn('parentUrl', 'text')
        .addColumn('text', 'text', (col) => col.notNull())
        .addColumn('embeds', 'json', (col) =>
            col.notNull().defaultTo(sql`'[]'`),
        )
        .addColumn('mentions', 'json', (col) =>
            col.notNull().defaultTo(sql`'[]'`),
        )
        .addColumn('mentionsPositions', 'json', (col) =>
            col.notNull().defaultTo(sql`'[]'`),
        )
        .execute()

    await db.schema
        .createIndex('casts_active_fid_timestamp_index')
        .on('casts')
        .columns(['fid', 'timestamp'])
        .where(sql.ref('deleted_at'), 'is', null) // Only index active (non-deleted) casts
        .execute()

    await db.schema
        .createIndex('casts_timestamp_index')
        .on('casts')
        .columns(['timestamp'])
        .execute()

    await db.schema
        .createIndex('casts_parent_hash_index')
        .on('casts')
        .column('parentHash')
        .where('parentHash', 'is not', null)
        .execute()

    await db.schema
        .createIndex('casts_root_parent_hash_index')
        .on('casts')
        .columns(['rootParentHash'])
        .where('rootParentHash', 'is not', null)
        .execute()

    await db.schema
        .createIndex('casts_parent_url_index')
        .on('casts')
        .columns(['parentUrl'])
        .where('parentUrl', 'is not', null)
        .execute()

    await db.schema
        .createIndex('casts_root_parent_url_index')
        .on('casts')
        .columns(['rootParentUrl'])
        .where('rootParentUrl', 'is not', null)
        .execute()

    // REACTIONS
    await db.schema
        .createTable('reactions')
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
        .addColumn('targetCastFid', 'bigint')
        .addColumn('type', 'int2', (col) => col.notNull())
        .addColumn('hash', 'bytea', (col) => col.notNull().unique())
        .addColumn('targetCastHash', 'bytea')
        .addColumn('targetUrl', 'text')
        .execute()

    await db.schema
        .createIndex('reactions_active_fid_timestamp_index')
        .on('reactions')
        .columns(['fid', 'timestamp'])
        .where(sql.ref('deleted_at'), 'is', null) // Only index active (non-deleted) reactions
        .execute()

    await db.schema
        .createIndex('reactions_target_cast_hash_index')
        .on('reactions')
        .column('targetCastHash')
        .where('targetCastHash', 'is not', null)
        .execute()

    await db.schema
        .createIndex('reactions_target_url_index')
        .on('reactions')
        .columns(['targetUrl'])
        .where('targetUrl', 'is not', null)
        .execute()
}

// biome-ignore lint/suspicious/noExplicitAny: TODO: remove any
export const down = async (db: Kysely<any>) => {
    // Delete in reverse order of above so that foreign keys are not violated.
    await db.schema.dropTable('userData').ifExists().execute()
    await db.schema.dropTable('verifications').ifExists().execute()
    await db.schema.dropTable('links').ifExists().execute()
    await db.schema.dropTable('reactions').ifExists().execute()
    await db.schema.dropTable('casts').ifExists().execute()
    await db.schema.dropTable('fnames').ifExists().execute()
    await db.schema.dropTable('fids').ifExists().execute()
}
