import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import { toHex } from 'viem'
import { reactions } from '../lib/drizzle/schema.ts'
import { log } from '../log'
import { formatReactions } from './utils'

/**
 * Insert a reaction in the database
 * @param {Message[]} msgs Hub events in JSON format
 * @param {PostgresJsTransaction} trx The database transaction
 */
export async function insertReactions({
    msgs,
    trx,
}: { msgs: Message[]; trx: PostgresJsTransaction<any, any> }) {
    const values = formatReactions(msgs)

    try {
        await trx.insert(reactions).values(values).onConflictDoNothing()
        // .execute()

        log.debug('REACTIONS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING REACTIONS')
    }
}

/**
 * Soft delete a reaction in the database by setting the deletedAt field
 * @param {Message[]} msgs Hub events in JSON format
 * @param {PostgresJsTransaction} trx The database transaction
 */
export async function deleteReactions({
    msgs,
    trx,
}: { msgs: Message[]; trx: PostgresJsTransaction<any, any> }) {
    try {
        for (const msg of msgs) {
            const data = msg.data
            if (!data || !data.reactionBody) {
                throw new Error('Unexpected missing data or reactionBody')
            }
            const reaction = data.reactionBody

            if (reaction.targetCastId) {
                await trx
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
            } else if (reaction.targetUrl) {
                await trx
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
            }
        }

        log.debug('REACTIONS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING REACTION')
    }
}
