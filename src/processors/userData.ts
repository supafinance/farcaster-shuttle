import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import { userData } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'

export async function insertUserDatas({
    msgs,
    txn,
}: { msgs: Message[]; txn: PostgresJsTransaction<any, any> }) {
    log.debug('INSERTING USER DATA')
    await Promise.all(
        msgs.map(async (msg) => {
            const data = msg.data
            if (!data || !data.userDataBody) {
                return
            }
            const value = data.userDataBody

            if (!data.fid) {
                return
            }

            const formattedTimestamp = new Date(
                fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
            ).toISOString()

            switch (value.type) {
                // NONE
                case 0: {
                    break
                }
                // PFP
                case 1: {
                    try {
                        await txn
                            .insert(userData)
                            .values({
                                fid: String(data.fid),
                                pfp: String(value.value),
                                timestamp: formattedTimestamp,
                                pfpUpdatedAt: formattedTimestamp,
                            })
                            .onConflictDoUpdate({
                                target: userData.fid,
                                set: {
                                    pfp: value.value,
                                    pfpUpdatedAt: formattedTimestamp,
                                },
                            })
                        // .execute()
                    } catch (error) {
                        log.error(error, 'ERROR INSERTING USER DATA')
                    }
                    break
                }
                // DISPLAY
                case 2: {
                    try {
                        await txn
                            .insert(userData)
                            .values({
                                fid: String(data.fid),
                                displayName: value.value,
                                timestamp: formattedTimestamp,
                                displayNameUpdatedAt: formattedTimestamp,
                            })
                            .onConflictDoUpdate({
                                target: userData.fid,
                                set: {
                                    displayName: value.value,
                                    displayNameUpdatedAt: formattedTimestamp,
                                },
                            })
                        // .execute()

                        log.debug('USER DATA INSERTED')
                    } catch (error) {
                        log.error(error, 'ERROR INSERTING USER DATA')
                    }
                    break
                }
                // BIO
                case 3: {
                    try {
                        await txn
                            .insert(userData)
                            .values({
                                fid: String(data.fid),
                                bio: value.value,
                                timestamp: formattedTimestamp,
                                bioUpdatedAt: formattedTimestamp,
                            })
                            .onConflictDoUpdate({
                                target: userData.fid,
                                set: {
                                    bio: value.value,
                                    bioUpdatedAt: formattedTimestamp,
                                },
                            })
                        // .execute()

                        log.debug('USER DATA INSERTED')
                    } catch (error) {
                        log.error(error, 'ERROR INSERTING USER DATA')
                    }
                    break
                }
                // URL
                case 5: {
                    try {
                        await txn
                            .insert(userData)
                            .values({
                                fid: String(data.fid),
                                url: value.value,
                                timestamp: formattedTimestamp,
                                urlUpdatedAt: formattedTimestamp,
                            })
                            .onConflictDoUpdate({
                                target: userData.fid,
                                set: {
                                    url: value.value,
                                    urlUpdatedAt: formattedTimestamp,
                                },
                            })
                        // .execute()

                        log.debug('USER DATA INSERTED')
                    } catch (error) {
                        log.error(error, 'ERROR INSERTING USER DATA')
                    }
                    break
                }
                // USERNAME
                case 6: {
                    try {
                        await txn
                            .insert(userData)
                            .values({
                                fid: String(data.fid),
                                username: value.value,
                                timestamp: new Date(
                                    fromFarcasterTime(
                                        data.timestamp,
                                    )._unsafeUnwrap(),
                                ).toISOString(),
                                usernameUpdatedAt: formattedTimestamp,
                            })
                            .onConflictDoUpdate({
                                target: userData.fid,
                                set: {
                                    username: value.value,
                                    usernameUpdatedAt: formattedTimestamp,
                                },
                            })
                        // .execute()

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
