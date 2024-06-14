import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { eq } from 'drizzle-orm'
import { toHex } from 'viem'
import { db } from '../lib/drizzle'
import { casts } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'
import { formatCasts } from './utils'

/**
 * Insert casts in the database
 * @param {Message[]} msgs Hub events in JSON format
 */
export async function insertCasts(msgs: Message[]) {
    const values = formatCasts(msgs)

    try {
        await db.insert(casts).values(values).onConflictDoNothing().execute()

        log.debug('CASTS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING CAST')
    }
}

/**
 * Add deletedAt to a cast in the database
 * @param {Message[]} msgs Hub events in JSON format
 */
export async function deleteCasts(msgs: Message[]) {
    try {
        for (const msg of msgs) {
            const data = msg.data

            if (!data || !data.castRemoveBody) {
                throw new Error('Unexpected missing data or castRemoveBody')
            }

            await db
                .update(casts)
                .set({
                    deletedAt: new Date(
                        fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                    ).toISOString(),
                })
                .where(eq(casts.hash, toHex(data.castRemoveBody?.targetHash)))
                .execute()
        }

        log.debug('CASTS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING CAST')
    }
}
