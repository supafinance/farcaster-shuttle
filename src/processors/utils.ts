import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import type { Insertable } from 'kysely'
import { toHex } from 'viem'
import type { Tables } from '../db.ts'

export function formatCasts(msgs: Message[]) {
    return msgs.map((msg) => {
        const data = msg.data

        if (!data || !data.castAddBody) {
            throw new Error('Unexpected missing data or castAddBody')
        }

        const castAddBody = data.castAddBody
        const timestamp = fromFarcasterTime(data.timestamp)._unsafeUnwrap()

        return {
            timestamp: new Date(timestamp),
            fid: data.fid,
            parentFid: castAddBody.parentCastId?.fid,
            hash: msg.hash,
            parentHash: castAddBody.parentCastId?.hash,
            parentUrl: castAddBody.parentUrl,
            text: castAddBody.text,
            embeds: JSON.stringify(castAddBody.embeds),
            mentions: JSON.stringify(castAddBody.mentions),
            mentionsPositions: JSON.stringify(castAddBody.mentionsPositions),
        } satisfies Insertable<Tables['casts']>
    })
}

export function formatReactions(msgs: Message[]) {
    return msgs.map((msg) => {
        const data = msg.data
        if (!data || !data.reactionBody) {
            throw new Error('Unexpected missing data or reactionBody')
        }

        const reaction = data.reactionBody
        const timestamp = fromFarcasterTime(data.timestamp)._unsafeUnwrap()

        return {
            timestamp: new Date(timestamp),
            fid: data.fid,
            targetCastFid: reaction.targetCastId?.fid,
            type: reaction.type,
            hash: msg.hash,
            targetCastHash: reaction.targetCastId?.hash,
            targetUrl: reaction.targetUrl,
        } satisfies Insertable<Tables['reactions']>
    })
}

export function formatVerifications(msgs: Message[]) {
    return msgs.map((msg) => {
        const data = msg.data
        if (!data || !data.verificationAddAddressBody) {
            throw new Error(
                'Unexpected missing data or verificationAddAddressBody',
            )
        }
        const addAddressBody = data.verificationAddAddressBody
        const timestamp = fromFarcasterTime(data.timestamp)._unsafeUnwrap()

        return {
            timestamp: new Date(timestamp),
            fid: data.fid,
            signerAddress: toHex(addAddressBody.address, { size: 20 }),
        } satisfies Insertable<Tables['verifications']>
    })
}

export function formatLinks(msgs: Message[]) {
    return msgs.map((msg) => {
        const data = msg.data
        if (!data || !data.linkBody) {
            throw new Error('Unexpected missing data or linkBody')
        }
        const link = data.linkBody
        const timestamp = fromFarcasterTime(data.timestamp)._unsafeUnwrap()

        return {
            timestamp: new Date(timestamp),
            fid: data.fid,
            targetFid: link.targetFid,
            displayTimestamp: link.displayTimestamp
                ? new Date(
                      fromFarcasterTime(link.displayTimestamp)._unsafeUnwrap(),
                  )
                : null,
            type: link.type,
            hash: msg.hash,
        } satisfies Insertable<Tables['links']>
    })
}

export function breakIntoChunks<T>(array: T[], size: number): T[][] {
    const chunks = []
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size))
    }
    return chunks
}
