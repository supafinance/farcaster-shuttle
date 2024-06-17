import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import { type Address, toHex } from 'viem'
import { verifications } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'
import { formatVerifications } from './utils.ts'

/**
 * Insert a new verification in the database
 * @param {Message[]} msgs Hub events in JSON format
 */
export async function insertVerifications({
    msgs,
    txn,
}: { msgs: Message[]; txn: PostgresJsTransaction<any, any> }) {
    const values = formatVerifications(msgs)

    if (!values || values.length === 0) {
        return
    }

    try {
        await txn.insert(verifications).values(values).onConflictDoNothing()
        log.debug('VERIFICATIONS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING VERIFICATION')
    }
}

/**
 * Soft delete a verification from the database by setting the deletedAt field
 * @param {Message[]} msgs Hub events in JSON format
 */
export async function deleteVerifications({
    msgs,
    txn,
}: { msgs: Message[]; txn: PostgresJsTransaction<any, any> }) {
    try {
        for (const msg of msgs) {
            const data = msg.data
            if (!data || !data.verificationRemoveBody) {
                continue
            }
            let address: Address
            try {
                address = toHex(data.verificationRemoveBody.address, {
                    size: 20,
                })
            } catch {
                return
            }

            await txn
                .update(verifications)
                .set({
                    deletedAt: new Date(
                        fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                    ).toISOString(),
                })
                .where(
                    and(
                        eq(verifications.signerAddress, address),
                        eq(verifications.fid, String(data.fid)),
                    ),
                )
        }

        log.debug('VERIFICATIONS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING VERIFICATION')
    }
}
