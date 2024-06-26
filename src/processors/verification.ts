import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { type Address, toHex } from 'viem'
import type { AppDb } from '../db.ts'
import { log } from '../log.ts'
import { formatVerifications } from './utils.ts'

/**
 * Insert a new verification in the database
 * @param msg Hub event in JSON format
 */
export async function insertVerifications({
    msgs,
    db,
}: { msgs: Message[]; db: AppDb }) {
    log.info('INSERTING VERIFICATIONS')
    const verifications = formatVerifications(msgs)

    if (!verifications) {
        return
    }

    try {
        await db
            .insertInto('verifications')
            .values(verifications)
            .onConflict((oc) =>
                oc.columns(['fid', 'signerAddress']).doNothing(),
            )
            .execute()

        log.debug('VERIFICATIONS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING VERIFICATION')
    }
}

/**
 * Delete a verification from the database
 * @param msg Hub event in JSON format
 */
export async function deleteVerifications({
    msgs,
    db,
}: { msgs: Message[]; db: AppDb }) {
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
                .updateTable('verifications')
                .set({
                    deletedAt: new Date(
                        fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                    ),
                })
                .where('signerAddress', '=', address)
                .where('fid', '=', data.fid)
                .execute()
        }

        log.debug('VERIFICATIONS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING VERIFICATION')
    }
}
