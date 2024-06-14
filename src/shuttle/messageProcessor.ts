import { Message, validations } from '@farcaster/hub-nodejs'
import type { pino } from 'pino'
import { toHex } from 'viem'
import { messages } from '../lib/drizzle/schema.ts'
import {
    bytesToHex,
    convertProtobufMessageBodyToJson,
    farcasterTimeToDate,
} from '../utils'
import type { StoreMessageOperation } from './'
import type { DB, InsertableMessageRow } from './db'

// biome-ignore lint/complexity/noStaticOnlyClass: todo: update to pure functions
export class MessageProcessor {
    static async storeMessage(
        message: Message,
        trx: DB,
        operation: StoreMessageOperation = 'merge',
        log: pino.Logger | undefined = undefined,
        validate = true,
    ): Promise<boolean> {
        // Only validate merge messages since we may be deleting an invalid message
        if (validate && operation === 'merge') {
            const validation = await validations.validateMessage(message)
            if (validation.isErr()) {
                log?.warn(
                    `Invalid message ${bytesToHex(message.hash)}: ${
                        validation.error.message
                    }`,
                )
                throw new Error(`Invalid message: ${validation.error.message}`)
            }
        }

        if (!message.data) throw new Error('Message data is missing')

        const body = convertProtobufMessageBodyToJson(message)

        const opData: Pick<
            InsertableMessageRow,
            'deletedAt' | 'revokedAt' | 'prunedAt'
        > = {
            deletedAt: null,
            prunedAt: null,
            revokedAt: null,
        }

        switch (operation) {
            case 'merge':
                break
            case 'delete':
                opData.deletedAt = new Date().toISOString()
                break
            case 'prune':
                opData.prunedAt = new Date().toISOString()
                break
            case 'revoke':
                opData.revokedAt = new Date().toISOString()
                break
        }

        const result = await trx
            .insert(messages)
            .values({
                fid: String(message.data.fid),
                type: Number(message.data.type),
                timestamp: (
                    farcasterTimeToDate(message.data.timestamp) ?? new Date()
                ).toISOString(),
                hashScheme: Number(message.hashScheme),
                signatureScheme: Number(message.signatureScheme),
                hash: toHex(message.hash),
                signer: toHex(message.signer),
                raw: String(Message.encode(message).finish()),
                body,
            })
            .onConflictDoUpdate({
                target: [messages.hash, messages.fid, messages.type],
                set: {
                    signatureScheme: message.signatureScheme,
                    signer: toHex(message.signer),
                    raw: String(Message.encode(message).finish()),
                    ...opData,
                },
                // .where(({ eb, or }) =>
                //     or([
                //         eb('excluded.deletedAt', 'is not', null).and(
                //             'messages.deletedAt',
                //             'is',
                //             null,
                //         ),
                //         eb('excluded.deletedAt', 'is', null).and(
                //             'messages.deletedAt',
                //             'is not',
                //             null,
                //         ),
                //         eb('excluded.prunedAt', 'is not', null).and(
                //             'messages.prunedAt',
                //             'is',
                //             null,
                //         ),
                //         eb('excluded.prunedAt', 'is', null).and(
                //             'messages.prunedAt',
                //             'is not',
                //             null,
                //         ),
                //         eb('excluded.revokedAt', 'is not', null).and(
                //             'messages.revokedAt',
                //             'is',
                //             null,
                //         ),
                //         eb('excluded.revokedAt', 'is', null).and(
                //             'messages.revokedAt',
                //             'is not',
                //             null,
                //         ),
                //     ]),
                // ),
            })
            .returning({ id: messages.id })
        return !!result
    }
}
