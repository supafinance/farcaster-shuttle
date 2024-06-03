import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import type { AppDb } from '../db.ts'
import { log } from '../log.ts'
import { formatLinks } from './utils.ts'

export async function insertLinks({
    msgs,
    db,
}: { msgs: Message[]; db: AppDb }) {
    log.info('INSERTING LINKS')
    const links = formatLinks(msgs)

    if (!links) {
        return
    }

    try {
        await db
            .insertInto('links')
            .values(links)
            .onConflict((oc) => oc.column('hash').doNothing())
            .execute()

        log.debug('LINKS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING LINK')
    }
}

export async function deleteLinks({
    msgs,
    db,
}: { msgs: Message[]; db: AppDb }) {
    log.info('DELETING LINKS')
    try {
        for (const msg of msgs) {
            const data = msg.data

            if (data) {
                await db
                    .updateTable('links')
                    .set({
                        deletedAt: new Date(
                            fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                        ),
                    })
                    .where('fid', '=', data.fid)
                    .where('targetFid', '=', data.linkBody?.targetFid!)
                    .execute()
            }
        }

        log.debug('LINKS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING LINK')
    }
}
