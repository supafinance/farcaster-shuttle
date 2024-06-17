import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import { links } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'
import { formatLinks } from './utils.ts'

/**
 * Inserts links into the database.
 * @param {Message[]} msgs - The messages to insert.
 * @param {PostgresJsTransaction} trx - The database transaction.
 */
export async function insertLinks({
    msgs,
    trx,
}: { msgs: Message[]; trx: PostgresJsTransaction<any, any> }) {
    const values = formatLinks(msgs)

    if (!values || values.length === 0) {
        return
    }

    try {
        const res = await trx
            .insert(links)
            .values(values)
            .onConflictDoNothing() /*.execute()*/
            .execute()
        log.debug('LINKS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING LINK')
    }
}

/**
 * Deletes links from the database.
 * @param {Message[]} msgs - The messages to delete.
 * @param {PostgresJsTransaction} trx - The database transaction.
 */
export async function deleteLinks({
    msgs,
    trx,
}: { msgs: Message[]; trx: PostgresJsTransaction<any, any> }) {
    try {
        for (const msg of msgs) {
            const data = msg.data

            if (data) {
                await trx
                    .update(links)
                    .set({
                        deletedAt: new Date(
                            fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                        ).toISOString(),
                    })
                    .where(
                        and(
                            eq(links.fid, String(data.fid)),
                            eq(
                                links.targetFid,
                                String(data.linkBody?.targetFid),
                            ),
                        ),
                    )
                    .execute()
            }
        }

        log.debug('LINKS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING LINK')
    }
}
