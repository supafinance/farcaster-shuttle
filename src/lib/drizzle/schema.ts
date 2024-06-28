import { relations } from 'drizzle-orm'
import {
    boolean,
    decimal,
    index,
    integer,
    json,
    pgTable,
    primaryKey,
    serial,
    smallint,
    text,
    timestamp,
    varchar,
} from 'drizzle-orm/pg-core'
import type { Address, Hex } from 'viem'

export const users = pgTable('users', {
    id: varchar('id', { length: 100 }).primaryKey(), // passkey rawId
    address: varchar('address', { length: 42 }).$type<Address>().notNull(), // passkey account
    pubKey: varchar('pubKey', { length: 130 }).$type<Hex>().notNull(), // passkey pubKey
    fid: decimal('fid', { precision: 12, scale: 0 }),
})

export const userData = pgTable('user_data', {
    fid: decimal('fid', { precision: 12, scale: 0 }).primaryKey(),
    createdAt: timestamp('created_at', { mode: 'string' })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
        .notNull()
        .defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'string' }),
    timestamp: timestamp('timestamp', { mode: 'string' })
        .notNull()
        .defaultNow(),
    pfp: text('pfp'),
    pfpUpdatedAt: timestamp('pfp_updated_at', { mode: 'string' }),
    username: text('username'),
    usernameUpdatedAt: timestamp('username_updated_at', { mode: 'string' }),
    displayName: text('display_name'),
    displayNameUpdatedAt: timestamp('display_name_updated_at', {
        mode: 'string',
    }),
    bio: text('bio'),
    bioUpdatedAt: timestamp('bio_updated_at', { mode: 'string' }),
    url: text('url'),
    urlUpdatedAt: timestamp('url_updated_at', { mode: 'string' }),
    powerBadge: boolean('power_badge').notNull().default(false),
    followersCount: integer('followers_count').notNull().default(0),
    followingCount: integer('following_count').notNull().default(0),
})

export const userDataRelations = relations(userData, ({ many }) => ({
    followers: many(links),
    followings: many(links),
    verifications: many(verifications),
}))

export const links = pgTable(
    'links',
    {
        id: serial('id').primaryKey(),
        // hash: varchar('hash', { length: 256 }).$type<Hex>(),
        fid: decimal('fid', { precision: 12, scale: 0 }).notNull(),
        targetFid: decimal('target_fid', { precision: 12, scale: 0 }).notNull(),
        createdAt: timestamp('created_at', { mode: 'string' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'string' })
            .notNull()
            .defaultNow(),
        deletedAt: timestamp('deleted_at', { mode: 'string' }),
        timestamp: timestamp('timestamp', { mode: 'string' })
            .notNull()
            .defaultNow(),
        displayTimestamp: timestamp('display_timestamp', { mode: 'string' }),
        type: text('type').$type<'follow'>(),
    },
    (table) => {
        return {
            followingIdx: index('following_idx').on(table.fid),
            followerIdx: index('follower_idx').on(table.targetFid),
        }
    },
)

export const linkRelations = relations(links, ({ one }) => ({
    follower: one(userData, {
        fields: [links.fid],
        references: [userData.fid],
    }),
    following: one(userData, {
        fields: [links.targetFid],
        references: [userData.fid],
    }),
}))

export const verifications = pgTable(
    'verifications',
    {
        id: serial('id').primaryKey(),
        // hash: varchar('hash', { length: 256 }).$type<Hex>(),
        createdAt: timestamp('created_at', { mode: 'string' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'string' })
            .notNull()
            .defaultNow(),
        timestamp: timestamp('timestamp', { mode: 'string' }).notNull(),
        deletedAt: timestamp('deleted_at', { mode: 'string' }),
        fid: decimal('fid', { precision: 12, scale: 0 }).notNull(),
        signerAddress: varchar('signer_address', { length: 42 })
            .notNull()
            .$type<Address>(),
    },
    (table) => {
        return {
            fidIdx: index('fid_idx').on(table.fid),
        }
    },
)

export const verificationRelations = relations(verifications, ({ one }) => ({
    userData: one(userData, {
        fields: [verifications.fid],
        references: [userData.fid],
    }),
}))

// export const messages = pgTable('messages', {
//     id: serial('id').primaryKey(),
//     createdAt: timestamp('created_at', { mode: 'string' })
//         .notNull()
//         .defaultNow(),
//     updatedAt: timestamp('updated_at', { mode: 'string' })
//         .notNull()
//         .defaultNow(),
//     timestamp: timestamp('timestamp', { mode: 'string' }).notNull(),
//     deletedAt: timestamp('deleted_at', { mode: 'string' }),
//     prunedAt: timestamp('pruned_at', { mode: 'string' }),
//     revokedAt: timestamp('revoked_at', { mode: 'string' }),
//     fid: decimal('fid', { precision: 12, scale: 0 }).notNull(),
//     type: integer('type').notNull(),
//     hashScheme: integer('hash_scheme').notNull(),
//     signatureScheme: integer('signature_scheme').notNull(),
//     hash: varchar('hash', { length: 256 }).$type<Hex>(),
//     signer: varchar('signer', { length: 256 }).$type<Hex>(),
//     body: json('body'),
//     raw: varchar('raw', { length: 256 }),
// })

export const reactions = pgTable('reactions', {
    id: serial('id').primaryKey(),
    createdAt: timestamp('created_at', { mode: 'string' })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
        .notNull()
        .defaultNow(),
    timestamp: timestamp('timestamp', { mode: 'string' }).notNull(),
    deletedAt: timestamp('deleted_at', { mode: 'string' }),
    fid: decimal('fid', { precision: 12, scale: 0 }).notNull(),
    targetCastFid: decimal('target_cast_fid', {
        precision: 12,
        scale: 0,
    }).notNull(),
    type: smallint('type').notNull(),
    hash: varchar('hash', { length: 256 }).$type<Hex>(),
    targetCastHash: varchar('target_cast_hash', { length: 256 }).$type<Hex>(),
    targetUrl: text('target_url'),
})

export const events = pgTable('events', {
    id: integer('id').primaryKey(),
})

export const casts = pgTable('casts', {
    id: serial('id').primaryKey(),
    fid: decimal('fid', { precision: 12, scale: 0 }).notNull(),
    parentFid: decimal('parent_fid', { precision: 12, scale: 0 }),
    hash: varchar('hash', { length: 256 }).$type<Hex>(),
    parentHash: varchar('parent_hash', { length: 256 }).$type<Hex>(),
    parentUrl: text('parent_url'),
    text: text('text'),
    embeds: json('embeds'),
    mentions: json('mentions'),
    mentionsPositions: json('mentions_positions'),
    timestamp: timestamp('timestamp', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
        .notNull()
        .defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'string' }),
})

export const socialScore = pgTable(
    'social_score',
    {
        fid: decimal('fid', { precision: 12, scale: 0 }).notNull(),
        targetFid: decimal('target_fid', { precision: 12, scale: 0 }).notNull(),
        score: decimal('score', { precision: 12, scale: 1 }).notNull(),
    },
    (table) => {
        return {
            pk: primaryKey({ columns: [table.fid, table.targetFid] }),
        }
    },
)
