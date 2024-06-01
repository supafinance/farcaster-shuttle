import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import type { Insertable } from 'kysely'
import type { Tables } from '../db.ts'

export function formatUserDatas(msgs: Message[]) {
    // Users can submit multiple messages with the same `userDataAddBody.type` within the batch period
    // We reconcile this by using the value of the last message with the same type from that fid
    const userDataMap = new Map<string, Message>()

    for (const msg of msgs) {
        const data = msg.data
        if (!data || !data.userDataBody) {
            continue
        }
        const userDataAddBody = data.userDataBody
        userDataMap.set(`fid:${data.fid}-type:${userDataAddBody.type}`, msg)
    }

    return Array.from(userDataMap.values()).map((msg) => {
        const data = msg.data
        if (!data || !data.userDataBody) {
            throw new Error('Unexpected missing data or userDataBody')
        }
        const userDataAddBody = data.userDataBody
        const timestamp = fromFarcasterTime(data.timestamp)._unsafeUnwrap()

        return {
            timestamp: new Date(timestamp),
            fid: data.fid,
            type: userDataAddBody.type,
            hash: msg.hash,
            value: userDataAddBody.value,
        } satisfies Insertable<Tables['userData']>
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
            hash: msg.hash,
            signerAddress: addAddressBody.address,
            blockHash: addAddressBody.blockHash,
            signature: addAddressBody.claimSignature,
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
