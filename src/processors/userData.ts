import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import type { AppDb } from '../db.ts'
import { log } from '../log.ts'

export async function insertUserDatas({
    msgs,
    db,
}: { msgs: Message[]; db: AppDb }) {
    log.info('INSERTING USER DATA')
    await Promise.all(
        msgs.map(async (msg) => {
            const data = msg.data
            if (!data || !data.userDataBody) {
                return
            }
            const userData = data.userDataBody

            switch (userData.type) {
                // NONE
                case 0: {
                    break
                }
                // PFP
                case 1: {
                    try {
                        await db
                            .insertInto('userData')
                            .values({
                                fid: data.fid,
                                pfp: userData.value,
                                timestamp: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                                pfpUpdatedAt: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                            })
                            .onConflict((oc) =>
                                oc.columns(['fid']).doUpdateSet((eb) => ({
                                    pfp: eb.ref('excluded.pfp'),
                                    pfpUpdatedAt: eb.ref(
                                        'excluded.pfpUpdatedAt',
                                    ),
                                })),
                            )
                            .execute()
                    } catch (error) {
                        log.error(error, 'ERROR INSERTING USER DATA')
                    }
                    break
                }
                // DISPLAY
                case 2: {
                    try {
                        await db
                            .insertInto('userData')
                            .values({
                                fid: data.fid,
                                displayName: userData.value,
                                timestamp: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                                displayNameUpdatedAt: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                            })
                            .onConflict((oc) =>
                                oc.columns(['fid']).doUpdateSet((eb) => ({
                                    displayName: eb.ref('excluded.displayName'),
                                    displayNameUpdatedAt: eb.ref(
                                        'excluded.displayNameUpdatedAt',
                                    ),
                                })),
                            )
                            .execute()

                        log.debug('USER DATA INSERTED')
                    } catch (error) {
                        log.error(error, 'ERROR INSERTING USER DATA')
                    }
                    break
                }
                // BIO
                case 3: {
                    try {
                        await db
                            .insertInto('userData')
                            .values({
                                fid: data.fid,
                                bio: userData.value,
                                timestamp: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                                bioUpdatedAt: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                            })
                            .onConflict((oc) =>
                                oc.columns(['fid']).doUpdateSet((eb) => ({
                                    bio: eb.ref('excluded.bio'),
                                    bioUpdatedAt: eb.ref(
                                        'excluded.bioUpdatedAt',
                                    ),
                                })),
                            )
                            .execute()

                        log.debug('USER DATA INSERTED')
                    } catch (error) {
                        log.error(error, 'ERROR INSERTING USER DATA')
                    }
                    break
                }
                // URL
                case 5: {
                    try {
                        await db
                            .insertInto('userData')
                            .values({
                                fid: data.fid,
                                url: userData.value,
                                timestamp: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                                urlUpdatedAt: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                            })
                            .onConflict((oc) =>
                                oc.columns(['fid']).doUpdateSet((eb) => ({
                                    url: eb.ref('excluded.url'),
                                    urlUpdatedAt: eb.ref(
                                        'excluded.urlUpdatedAt',
                                    ),
                                })),
                            )
                            .execute()

                        log.debug('USER DATA INSERTED')
                    } catch (error) {
                        log.error(error, 'ERROR INSERTING USER DATA')
                    }
                    break
                }
                // USERNAME
                case 6: {
                    try {
                        await db
                            .insertInto('userData')
                            .values({
                                fid: data.fid,
                                username: userData.value,
                                timestamp: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                                usernameUpdatedAt: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ),
                            })
                            .onConflict((oc) =>
                                oc.columns(['fid']).doUpdateSet((eb) => ({
                                    username: eb.ref('excluded.username'),
                                    usernameUpdatedAt: eb.ref(
                                        'excluded.usernameUpdatedAt',
                                    ),
                                })),
                            )
                            .execute()

                        log.debug('USER DATA INSERTED')
                    } catch (error) {
                        log.error(error, 'ERROR INSERTING USER DATA')
                    }
                    break
                }
                default:
                    log.error('UNKNOWN USER DATA TYPE')
            }
        }),
    )
}
