import type {
    ReactionType,
    UserDataType,
    UserNameType,
} from '@farcaster/hub-nodejs'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Hex } from 'viem'

export type DB = PostgresJsDatabase<any>

export type Fid = number
export type VerificationProtocol = 'ethereum' | 'solana'

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
