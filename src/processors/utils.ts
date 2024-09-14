import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import type { InferInsertModel } from 'drizzle-orm'
import { toHex } from 'viem'
import type {
    casts,
    links,
    reactions,
    verifications,
} from '../lib/drizzle/schema.ts'

type Cast = InferInsertModel<typeof casts>
type Reaction = InferInsertModel<typeof reactions>
type Verification = InferInsertModel<typeof verifications>
type Link = InferInsertModel<typeof links>

export function formatCasts(msgs: Message[]) {
    return msgs
        .map((msg) => {
            const data = msg.data

            if (!data || !data.castAddBody) {
                throw new Error('Unexpected missing data or castAddBody')
            }

            const castAddBody = data.castAddBody
            const timestamp = fromFarcasterTime(data.timestamp)._unsafeUnwrap()

            return {
                timestamp: new Date(timestamp).toISOString(),
                fid: String(data.fid),
                parentFid: String(castAddBody.parentCastId?.fid),
                hash: toHex(msg.hash),
                parentHash: castAddBody.parentCastId?.hash
                    ? toHex(castAddBody.parentCastId?.hash)
                    : null,
                parentUrl: castAddBody.parentUrl,
                text: castAddBody.text,
                embeds: JSON.stringify(castAddBody.embeds),
                mentions: JSON.stringify(castAddBody.mentions),
                mentionsPositions: JSON.stringify(
                    castAddBody.mentionsPositions,
                ),
            } satisfies Cast
        })
        .filter((v) => v !== undefined) as Cast[]
}

export function formatReactions(msgs: Message[]) {
    return msgs
        .map((msg) => {
            const data = msg.data
            if (!data || !data.reactionBody) {
                throw new Error('Unexpected missing data or reactionBody')
            }

            const reaction = data.reactionBody
            const timestamp = fromFarcasterTime(data.timestamp)._unsafeUnwrap()

            return {
                timestamp: new Date(timestamp).toISOString(),
                fid: String(data.fid),
                targetCastFid: String(reaction.targetCastId?.fid),
                type: reaction.type,
                hash: toHex(msg.hash),
                targetCastHash: reaction.targetCastId?.hash
                    ? toHex(reaction.targetCastId?.hash)
                    : null,
                targetUrl: reaction.targetUrl,
            } satisfies Reaction
        })
        .filter((v) => v !== undefined) as Reaction[]
}

export function formatVerifications(msgs: Message[]): Verification[] {
    return msgs
        .map((msg) => {
            try {
                const data = msg.data
                if (!data || !data.verificationAddAddressBody) {
                    throw new Error(
                        'Unexpected missing data or verificationAddAddressBody',
                    )
                }
                const addAddressBody = data.verificationAddAddressBody
                const timestamp = fromFarcasterTime(
                    data.timestamp,
                )._unsafeUnwrap()

                return {
                    timestamp: new Date(timestamp).toISOString(),
                    fid: String(data.fid),
                    signerAddress: toHex(addAddressBody.address, { size: 20 }),
                } satisfies Verification
            } catch {}
        })
        .filter((v) => v !== undefined) as Verification[]
}

export function formatLinks(msgs: Message[]) {
    return msgs
        .map((msg) => {
            const data = msg.data
            if (!data || !data.linkBody) {
                throw new Error('Unexpected missing data or linkBody')
            }
            const link = data.linkBody
            if (link.type !== 'follow') {
                throw new Error('Link type is not follow')
            }

            const timestamp = new Date(
                fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
            ).toISOString()
            const displayTimestamp = link.displayTimestamp
                ? new Date(
                      fromFarcasterTime(link.displayTimestamp)._unsafeUnwrap(),
                  ).toISOString()
                : null

            return {
                timestamp,
                fid: String(data.fid),
                targetFid: String(link.targetFid),
                displayTimestamp,
                type: link.type,
            } satisfies Link
        })
        .filter((v) => v !== undefined) as Link[]
}
