import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import { links } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'
import { formatLinks } from './utils.ts'

/**
 * Inserts links into the database.
 * @param {Message[]} msgs - The messages to insert.
 */
export async function insertLinks({
    msgs,
    txn,
}: { msgs: Message[]; txn: PostgresJsTransaction<any, any> }) {
    const values = formatLinks(msgs)

    if (!values || values.length === 0) {
        return
    }

    try {
        await txn.insert(links).values(values).onConflictDoNothing().execute()
        log.debug('LINKS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING LINK')
    }
}

/**
 * Deletes links from the database.
 * @param {Message[]} msgs - The messages to delete.
 */
export async function deleteLinks({
    msgs,
    txn,
}: { msgs: Message[]; txn: PostgresJsTransaction<any, any> }) {
    try {
        for (const msg of msgs) {
            const data = msg.data

            if (data) {
                await txn
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
