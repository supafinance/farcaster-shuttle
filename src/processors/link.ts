import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { and, eq } from 'drizzle-orm'
import { db } from '../lib/drizzle'
import { links } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'
import { formatLinks } from './utils.ts'

/**
 * Inserts links into the database.
 * @param {Message[]} msgs - The messages to insert.
 */
export async function insertLinks(msgs: Message[]) {
    log.info('INSERTING LINKS')
    const values = formatLinks(msgs)

    if (!values) {
        return
    }

    try {
        await db.insert(links).values(values).onConflictDoNothing().execute()

        log.debug('LINKS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING LINK')
    }
}

/**
 * Deletes links from the database.
 * @param {Message[]} msgs - The messages to delete.
 */
export async function deleteLinks(msgs: Message[]) {
    log.info('DELETING LINKS')
    try {
        for (const msg of msgs) {
            const data = msg.data

            if (data) {
                await db
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
