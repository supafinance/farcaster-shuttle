import { type Message, fromFarcasterTime } from '@farcaster/hub-nodejs'
import type { AppDb } from '../db'
import { log } from '../log'
import { formatReactions } from './utils'

/**
 * Insert a reaction in the database
 * @param msgs Hub events in JSON format
 * @param db Database connection
 */
export async function insertReactions(msgs: Message[], db: AppDb) {
    const reactions = formatReactions(msgs)

    try {
        await db
            .insertInto('reactions')
            .values(reactions)
            .onConflict((oc) => oc.column('hash').doNothing())
            .execute()

        log.debug('REACTIONS INSERTED')
    } catch (error) {
        log.error(error, 'ERROR INSERTING REACTIONS')
    }
}

export async function deleteReactions(msgs: Message[], db: AppDb) {
    try {
        for (const msg of msgs) {
            const data = msg.data
            if (!data || !data.reactionBody) {
                throw new Error('Unexpected missing data or reactionBody')
            }
            const reaction = data.reactionBody

            if (reaction.targetCastId) {
                await db
                    .updateTable('reactions')
                    .set({
                        deletedAt: new Date(
                            fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                        ),
                    })
                    .where('fid', '=', data.fid)
                    .where('type', '=', reaction.type)
                    .where('targetCastHash', '=', reaction.targetCastId.hash)
                    .execute()
            } else if (reaction.targetUrl) {
                await db
                    .updateTable('reactions')
                    .set({
                        deletedAt: new Date(
                            fromFarcasterTime(data.timestamp)._unsafeUnwrap(),
                        ),
                    })
                    .where('fid', '=', data.fid)
                    .where('type', '=', reaction.type)
                    .where('targetUrl', '=', reaction.targetUrl)
                    .execute()
            }
        }

        log.debug('REACTIONS DELETED')
    } catch (error) {
        log.error(error, 'ERROR DELETING REACTION')
    }
}
