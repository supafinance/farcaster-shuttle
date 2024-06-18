import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { eq } from 'drizzle-orm'
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import { toHex } from 'viem'
import { casts } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'
import { formatCasts } from './utils'

/**
 * Insert casts in the database
 * @param {object} args - The arguments object.
 * @param {Message[]} args.msgs Hub events in JSON format
 * @param {PostgresJsTransaction} args.trx The database transaction
 */
export async function insertCasts({
    msgs,
    trx,
}: { msgs: Message[]; trx: PostgresJsTransaction<any, any> }) {
    const values = formatCasts(msgs)

    try {
        await trx.insert(casts).values(values).onConflictDoNothing().execute()

        log.debug('CASTS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING CAST')
    }
}

/**
 * Add deletedAt to a cast in the database
 * @param {Object} args
 * @param {Message[]} args.msgs Hub events in JSON format
 * @param {PostgresJsTransaction} args.trx The database transaction
 */
export async function deleteCasts({
    msgs,
    trx,
}: { msgs: Message[]; trx: PostgresJsTransaction<any, any> }) {
    try {
        for (const msg of msgs) {
            const data = msg.data

            if (!data || !data.castRemoveBody) {
                throw new Error('Unexpected missing data or castRemoveBody')
            }

            await trx
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
