import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { and, eq } from 'drizzle-orm'
import { type Address, toHex } from 'viem'
import { db } from '../lib/drizzle'
import { verifications } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'
import { formatVerifications } from './utils.ts'

/**
 * Insert a new verification in the database
 * @param {Message[]} msgs Hub events in JSON format
 */
export async function insertVerifications(msgs: Message[]) {
    log.info('INSERTING VERIFICATIONS')
    const values = formatVerifications(msgs)

    if (!values) {
        return
    }

    try {
        await db.insert(verifications).values(values).onConflictDoNothing()
        log.debug('VERIFICATIONS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING VERIFICATION')
    }
}

/**
 * Soft delete a verification from the database by setting the deletedAt field
 * @param {Message[]} msgs Hub events in JSON format
 */
export async function deleteVerifications(msgs: Message[]) {
    log.info('DELETING VERIFICATIONS')
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

            await db
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
                .execute()
        }

        log.debug('VERIFICATIONS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING VERIFICATION')
    }
}
