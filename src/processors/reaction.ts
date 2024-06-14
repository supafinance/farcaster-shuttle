import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { and, eq } from 'drizzle-orm'
import { toHex } from 'viem'
import { db } from '../lib/drizzle'
import { reactions } from '../lib/drizzle/schema.ts'
import { log } from '../log'
import { formatReactions } from './utils'

/**
 * Insert a reaction in the database
 * @param {Message[]} msgs Hub events in JSON format
 */
export async function insertReactions(msgs: Message[]) {
    const values = formatReactions(msgs)

    try {
        await db
            .insert(reactions)
            .values(values)
            .onConflictDoNothing()
            .execute()

        log.debug('REACTIONS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING REACTIONS')
    }
}

/**
 * Soft delete a reaction in the database by setting the deletedAt field
 * @param {Message[]} msgs Hub events in JSON format
 */
export async function deleteReactions(msgs: Message[]) {
    try {
        for (const msg of msgs) {
            const data = msg.data
            if (!data || !data.reactionBody) {
                throw new Error('Unexpected missing data or reactionBody')
            }
            const reaction = data.reactionBody

            if (reaction.targetCastId) {
                await db
                    .update(reactions)
                    .set({
                        deletedAt: new Date(
                            fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                        ).toISOString(),
                    })
                    .where(
                        and(
                            eq(reactions.fid, String(data.fid)),
                            eq(reactions.type, reaction.type),
                            eq(
                                reactions.targetCastHash,
                                toHex(reaction.targetCastId.hash),
                            ),
                        ),
                    )
                    .execute()
            } else if (reaction.targetUrl) {
                await db
                    .update(reactions)
                    .set({
                        deletedAt: new Date(
                            fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                        ).toISOString(),
                    })
                    .where(
                        and(
                            eq(reactions.fid, String(data.fid)),
                            eq(reactions.type, reaction.type),
                            eq(reactions.targetUrl, reaction.targetUrl),
                        ),
                    )
                    .execute()
            }
        }

        log.debug('REACTIONS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING REACTION')
    }
}
