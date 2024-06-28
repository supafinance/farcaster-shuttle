import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import { db } from '../lib/drizzle'
import { links, userData } from '../lib/drizzle/schema.ts'
import { log } from '../log.ts'
import { formatLinks } from './utils.ts'

/**
 * Inserts links into the database.
 * @param {object} args - The arguments object.
 * @param {Message[]} args.msgs - The messages to insert.
 * @param {PostgresJsTransaction} args.trx - The database transaction.
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
        // Insert links and get the result to determine which inserts were successful
        const insertResult = await trx
            .insert(links)
            .values(values)
            .onConflictDoNothing()
            .returning({ fid: links.fid, targetFid: links.targetFid })
            .execute()

        // Count the number of successful links for each fid and targetFid
        const followingCountMap = new Map()
        const followersCountMap = new Map()

        // biome-ignore lint/complexity/noForEach: <explanation>
        insertResult.forEach((row) => {
            // Increment the count for the fid
            followingCountMap.set(
                row.fid,
                (followingCountMap.get(row.fid) || 0) + 1,
            )

            // Increment the count for the targetFid
            followersCountMap.set(
                row.targetFid,
                (followersCountMap.get(row.targetFid) || 0) + 1,
            )
        })

        // Update following count
        await Promise.all(
            Array.from(followingCountMap.entries()).map(
                async ([fid, count]) => {
                    const userDataRow = await db
                        .select({ followingCount: userData.followingCount })
                        .from(userData)
                        .where(eq(userData.fid, fid))
                        .execute()

                    const currentFollowingCount =
                        userDataRow[0]?.followingCount || 0

                    await trx
                        .update(userData)
                        .set({ followingCount: currentFollowingCount + count })
                        .where(eq(userData.fid, fid))
                        .execute()
                },
            ),
        )

        // Update followers count
        await Promise.all(
            Array.from(followersCountMap.entries()).map(
                async ([targetFid, count]) => {
                    const userDataRow = await db
                        .select({ followersCount: userData.followersCount })
                        .from(userData)
                        .where(eq(userData.fid, targetFid))
                        .execute()

                    const currentFollowersCount =
                        userDataRow[0]?.followersCount || 0

                    await trx
                        .update(userData)
                        .set({ followersCount: currentFollowersCount + count })
                        .where(eq(userData.fid, targetFid))
                        .execute()
                },
            ),
        )

        log.debug('LINKS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING LINK')
    }
}

/**
 * Deletes links from the database.
 * @param {object} args - The arguments object.
 * @param {Message[]} args.msgs - The messages to delete.
 * @param {PostgresJsTransaction} args.trx - The database transaction.
 */
export async function deleteLinks({
    msgs,
    trx,
}: { msgs: Message[]; trx: PostgresJsTransaction<any, any> }) {
    try {
        const followingCountMap = new Map()
        const followersCountMap = new Map()

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

                // Increment the count for the fid
                followingCountMap.set(
                    data.fid,
                    (followingCountMap.get(data.fid) || 0) + 1,
                )

                // Increment the count for the targetFid
                followersCountMap.set(
                    data.linkBody?.targetFid,
                    (followersCountMap.get(data.linkBody?.targetFid) || 0) + 1,
                )
            }
        }

        // Update following count
        await Promise.all(
            Array.from(followingCountMap.entries()).map(
                async ([fid, count]) => {
                    const userDataRow = await trx
                        .select({ followingCount: userData.followingCount })
                        .from(userData)
                        .where(eq(userData.fid, fid))
                        .execute()

                    const currentFollowingCount =
                        userDataRow[0]?.followingCount || 0

                    await trx
                        .update(userData)
                        .set({
                            followingCount: Math.max(
                                currentFollowingCount - count,
                                0,
                            ),
                        }) // Ensure count doesn't go below 0
                        .where(eq(userData.fid, fid))
                        .execute()
                },
            ),
        )

        // Update followers count
        await Promise.all(
            Array.from(followersCountMap.entries()).map(
                async ([targetFid, count]) => {
                    const userDataRow = await trx
                        .select({ followersCount: userData.followersCount })
                        .from(userData)
                        .where(eq(userData.fid, targetFid))
                        .execute()

                    const currentFollowersCount =
                        userDataRow[0]?.followersCount || 0

                    await trx
                        .update(userData)
                        .set({
                            followersCount: Math.max(
                                currentFollowersCount - count,
                                0,
                            ),
                        }) // Ensure count doesn't go below 0
                        .where(eq(userData.fid, targetFid))
                        .execute()
                },
            ),
        )

        log.debug('LINKS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING LINK')
    }
}
