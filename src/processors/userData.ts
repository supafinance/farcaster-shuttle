import type { Message } from '@farcaster/hub-nodejs'
import type { AppDb } from '../db.ts'
import { log } from '../log.ts'
import { formatUserDatas } from './utils.ts'

export async function insertUserDatas({
    msgs,
    db,
}: { msgs: Message[]; db: AppDb }) {
    log.info('INSERTING USER DATA')
    const userDatas = formatUserDatas(msgs)

    if (!userDatas) {
        return
    }

    try {
        await db
            .insertInto('userData')
            .values(userDatas)
            .onConflict((oc) =>
                oc.columns(['fid', 'type']).doUpdateSet((eb) => ({
                    value: eb.ref('excluded.value'),
                })),
            )
            .execute()

        log.debug('USER DATA INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING USER DATA')
    }
}
