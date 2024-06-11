import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'

import type { AppDb } from '../db'
import { log } from '../log'
import { formatCasts } from './utils'

/**
 * Insert casts in the database
 * @param msg Hub event in JSON format
 */
export async function insertCasts(msgs: Message[], db: AppDb) {
    const casts = formatCasts(msgs)

    try {
        await db
            .insertInto('casts')
            .values(casts)
            .onConflict((oc) => oc.column('hash').doNothing())
            .execute()

        log.debug('CASTS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING CAST')
    }
}

/**
 * Update a cast in the database
 * @param hash Hash of the cast
 * @param change Object with the fields to update
 */
export async function deleteCasts(msgs: Message[], db: AppDb) {
    try {
        for (const msg of msgs) {
            const data = msg.data

            if (!data || !data.castRemoveBody) {
                throw new Error('Unexpected missing data or castRemoveBody')
            }

            await db
                .updateTable('casts')
                .set({
                    deletedAt: new Date(
                        fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                    ),
                })
                .where('hash', '=', data.castRemoveBody?.targetHash)
                .execute()
        }

        log.debug('CASTS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING CAST')
    }
}
