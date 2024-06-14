import type { Message } from '@farcaster/hub-nodejs'
import type { pino } from 'pino'
// import { messages } from '../lib/drizzle/schema.ts'
import type { StoreMessageOperation } from './'
import type { DB } from './db'

/**
 * Add a message to the database transaction.
 * @param {Message} message - The message to store.
 * @param {DB} trx - The database transaction.
 * @param {StoreMessageOperation} operation - The operation to perform.
 * @param {pino.Logger | undefined} log - The logger.
 * @param {boolean} validate - Whether to validate the message.
 */
export const storeMessage = async ({
    message,
    trx,
    operation = 'merge',
    log,
    validate = true,
}: {
    message: Message
    trx: DB
    operation: StoreMessageOperation
    log?: pino.Logger
    validate?: boolean
}): Promise<boolean> => {
    return true
    //     // Only validate merge messages since we may be deleting an invalid message
    //     if (validate && operation === 'merge') {
    //         const validation = await validations.validateMessage(message)
    //         if (validation.isErr()) {
    //             log?.warn(
    //                 `Invalid message ${bytesToHex(message.hash)}: ${
    //                     validation.error.message
    //                 }`,
    //             )
    //             throw new Error(`Invalid message: ${validation.error.message}`)
    //         }
    //     }
    //
    //     if (!message.data) throw new Error('Message data is missing')
    //
    //     const body = convertProtobufMessageBodyToJson(message)
    //
    //     const opData: Pick<
    //         InsertableMessageRow,
    //         'deletedAt' | 'revokedAt' | 'prunedAt'
    //     > = {
    //         deletedAt: null,
    //         prunedAt: null,
    //         revokedAt: null,
    //     }
    //
    //     switch (operation) {
    //         case 'merge':
    //             break
    //         case 'delete':
    //             opData.deletedAt = new Date().toISOString()
    //             break
    //         case 'prune':
    //             opData.prunedAt = new Date().toISOString()
    //             break
    //         case 'revoke':
    //             opData.revokedAt = new Date().toISOString()
    //             break
    //     }
    //
    //     const result = await trx
    //         .insert(messages)
    //         .values({
    //             fid: String(message.data.fid),
    //             type: Number(message.data.type),
    //             timestamp: (
    //                 farcasterTimeToDate(message.data.timestamp) ?? new Date()
    //             ).toISOString(),
    //             hashScheme: Number(message.hashScheme),
    //             signatureScheme: Number(message.signatureScheme),
    //             hash: toHex(message.hash),
    //             signer: toHex(message.signer),
    //             raw: String(Message.encode(message).finish()),
    //             body,
    //         })
    //         .onConflictDoUpdate({
    //             target: [messages.hash, messages.fid, messages.type],
    //             set: {
    //                 signatureScheme: message.signatureScheme,
    //                 signer: toHex(message.signer),
    //                 raw: String(Message.encode(message).finish()),
    //                 ...opData,
    //             },
    //             setWhere: sql`(
    //                 (EXCLUDED.deleted_at IS NOT NULL AND ${messages.deletedAt} IS NULL) OR
    //                 (EXCLUDED.deleted_at IS NULL AND ${messages.deletedAt} IS NOT NULL) OR
    //                 (EXCLUDED.pruned_at IS NOT NULL AND ${messages.prunedAt} IS NULL) OR
    //                 (EXCLUDED.pruned_at IS NULL AND ${messages.prunedAt} IS NOT NULL) OR
    //                 (EXCLUDED.revoked_at IS NOT NULL AND ${messages.revokedAt} IS NULL) OR
    //                 (EXCLUDED.revoked_at IS NULL AND ${messages.revokedAt} IS NOT NULL)
    //             )
    // `,
    //         })
    //         .returning({ id: messages.id })
    //     return !!result
}
