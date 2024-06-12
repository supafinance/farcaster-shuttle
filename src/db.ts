import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReactionType, UserNameType } from '@farcaster/hub-nodejs'
import type { Fid, Hex, HubTables } from '@farcaster/shuttle'
import {
    type ColumnType,
    FileMigrationProvider,
    type Generated,
    type GeneratedAlways,
    type Kysely,
    Migrator,
} from 'kysely'
import { type Result, err, ok } from 'neverthrow'
import type { Logger } from './log.ts'

// biome-ignore lint/correctness/noUnusedVariables: <explanation>
const createMigrator = async (db: Kysely<HubTables>, log: Logger) => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    return new Migrator({
        db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.join(currentDir, 'migrations'),
        }),
    })
}

export const migrateToLatest = async (
    db: Kysely<HubTables>,
    log: Logger,
): Promise<Result<void, unknown>> => {
    const migrator = await createMigrator(db, log)

    const { error, results } = await migrator.migrateToLatest()

    // biome-ignore lint/complexity/noForEach: <explanation>
    results?.forEach((it) => {
        if (it.status === 'Success') {
            log.info(
                `Migration "${it.migrationName}" was executed successfully`,
            )
        } else if (it.status === 'Error') {
            log.error(`failed to execute migration "${it.migrationName}"`)
        }
    })

    if (error) {
        log.error('Failed to apply all database migrations')
        log.error(error)
        return err(error)
    }

    log.info('Migrations up to date')
    return ok(undefined)
}

type CastIdJson = {
    fid: Fid
    hash: Hex
}

// FIDS -------------------------------------------------------------------------------------------
type FidRow = {
    fid: Fid
    createdAt: Generated<Date>
    updatedAt: Generated<Date>
    registeredAt: Date
    custodyAddress: Hex
    recoveryAddress: Hex
}

// FNAMES ------------------------------------------------------------------------------------------
declare const $fnameDbId: unique symbol
type FnameDbId = string & { [$fnameDbId]: true }

type FnameRow = {
    id: GeneratedAlways<FnameDbId>
    createdAt: Generated<Date>
    updatedAt: Generated<Date>
    registeredAt: Date
    deletedAt: Date | null
    fid: Fid
    type: UserNameType
    username: string
}

// CASTS -------------------------------------------------------------------------------------------
declare const $castDbId: unique symbol
type CastDbId = string & { [$castDbId]: true }

type CastEmbedJson = { url: string } | { castId: CastIdJson }

type CastRow = {
    id: GeneratedAlways<CastDbId>
    createdAt: Generated<Date>
    updatedAt: Generated<Date>
    timestamp: Date
    deletedAt: Date | null
    fid: Fid
    parentFid: Fid | null
    hash: Uint8Array
    rootParentHash: Uint8Array | null
    parentHash: Uint8Array | null
    rootParentUrl: string | null
    parentUrl: string | null
    text: string
    embeds: ColumnType<CastEmbedJson[], string, string>
    mentions: ColumnType<Fid[], string, string>
    mentionsPositions: ColumnType<number[], string, string>
}

// REACTIONS ---------------------------------------------------------------------------------------
declare const $reactionDbId: unique symbol
type ReactionDbId = string & { [$reactionDbId]: true }

type ReactionRow = {
    id: GeneratedAlways<ReactionDbId>
    createdAt: Generated<Date>
    updatedAt: Generated<Date>
    timestamp: Date
    deletedAt: Date | null
    fid: Fid
    targetCastFid: Fid | null
    type: ReactionType
    hash: Uint8Array
    targetCastHash: Uint8Array | null
    targetUrl: string | null
}

// LINKS -------------------------------------------------------------------------------------------
declare const $linkDbId: unique symbol
type LinkDbId = string & { [$linkDbId]: true }

type LinkRow = {
    id: GeneratedAlways<LinkDbId>
    createdAt: Generated<Date>
    updatedAt: Generated<Date>
    timestamp: Date
    deletedAt: Date | null
    fid: Fid
    targetFid: Fid | null
    displayTimestamp: Date | null
    type: string
    hash: Uint8Array
}

// VERIFICATIONS -----------------------------------------------------------------------------------
declare const $verificationDbId: unique symbol
type VerificationDbId = string & { [$verificationDbId]: true }

type VerificationRow = {
    id: GeneratedAlways<VerificationDbId>
    createdAt: Generated<Date>
    updatedAt: Generated<Date>
    timestamp: Date
    deletedAt: Date | null
    fid: Fid
    signerAddress: Hex
    blockHash: Uint8Array
    signature: Uint8Array
}

// USER DATA ---------------------------------------------------------------------------------------
declare const $userDataDbId: unique symbol
type UserDataDbId = Fid & { [$userDataDbId]: true }

type UserDataRow = {
    fid: Fid
    pfp: String | null
    pfpUpdatedAt: Date | null
    displayName: string | null
    displayNameUpdatedAt: Date | null
    bio: string | null
    bioUpdatedAt: Date | null
    url: string | null
    urlUpdatedAt: Date | null
    username: string | null
    usernameUpdatedAt: Date | null
    createdAt: Generated<Date>
    updatedAt: Generated<Date>
    timestamp: Date
    deletedAt: Date | null
}

// EVENTS ------------------------------------------------------------------------------------------
type EventRow = {
    id: number
}

// ALL TABLES --------------------------------------------------------------------------------------
export interface Tables extends HubTables {
    fnames: FnameRow
    fids: FidRow
    casts: CastRow
    reactions: ReactionRow
    links: LinkRow
    verifications: VerificationRow
    userData: UserDataRow
    events: EventRow
}

export type AppDb = Kysely<Tables>
