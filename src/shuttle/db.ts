import type {
    ReactionType,
    UserDataType,
    UserNameType,
} from '@farcaster/hub-nodejs'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { pgEnum } from 'drizzle-orm/pg-core'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { messages } from '../lib/drizzle/schema'

export type DB = PostgresJsDatabase<any>

export type Fid = number
export type Hex = `0x${string}`
export type VerificationProtocol = 'ethereum' | 'solana'

// Enums
export const reactionType = pgEnum('reaction_type', ['LIKE', 'DISLIKE']) // Example values
export const messageType = pgEnum('message_type', [
    'CAST',
    'REACTION',
    'VERIFICATION',
]) // Example values
export const hashScheme = pgEnum('hash_scheme', ['SHA256', 'KECCAK256']) // Example values
export const signatureScheme = pgEnum('signature_scheme', ['ECDSA', 'ED25519']) // Example values
export const userDataType = pgEnum('user_data_type', ['BIO', 'USERNAME']) // Example values
export const userNameType = pgEnum('user_name_type', ['EMAIL', 'USERNAME']) // Example values

type CastIdJson = {
    fid: Fid
    hash: Hex
}

export type CastAddBodyJson = {
    text: string
    embeds?: string[]
    mentions?: number[]
    mentionsPositions?: number[]
    parent?: CastIdJson | string
}

export type CastRemoveBodyJson = {
    targetHash: string
}

export type ReactionBodyJson = {
    type: ReactionType
    target: CastIdJson | string
}

export type VerificationAddEthAddressBodyJson = {
    address: string
    claimSignature: string
    blockHash: string
    protocol: string
}

export type VerificationRemoveBodyJson = {
    address: string
}

export type SignerAddBodyJson = {
    signer: string
    name: string
}

export type SignerRemoveBodyJson = {
    signer: string
}

export type UserDataBodyJson = {
    type: UserDataType
    value: string
}

export type LinkBodyJson = {
    type: string
    /** original timestamp in Unix ms */
    displayTimestamp?: number
    targetFid?: number
    targetFids?: number[]
}

export type UsernameProofBodyJson = {
    timestamp: number
    name: string
    owner: string
    signature: string
    fid: number
    type: UserNameType
}

export type MessageBodyJson =
    | CastAddBodyJson
    | CastRemoveBodyJson
    | ReactionBodyJson
    | LinkBodyJson
    | VerificationAddEthAddressBodyJson
    | VerificationRemoveBodyJson
    | SignerAddBodyJson
    | SignerRemoveBodyJson
    | UserDataBodyJson
    | UsernameProofBodyJson

export type MessageRow = InferSelectModel<typeof messages>
export type InsertableMessageRow = InferInsertModel<typeof messages>
