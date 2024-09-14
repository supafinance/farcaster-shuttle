import {
    type HubEvent,
    type Message,
    type MessageType,
    isMergeMessageHubEvent,
    isPruneMessageHubEvent,
    isRevokeMessageHubEvent,
} from '@farcaster/hub-nodejs'
import { App } from '../app.ts'
import { db } from '../lib/drizzle'
import type { MessageHandler } from './'
import type { DB } from './db'

/**
 * Processes a hub event.
 * @param {HubEvent} event - The hub event to process.
 * @param {MessageHandler} handler - The message handler.
 */
export async function processHubEvent(
    event: HubEvent,
    handler: MessageHandler,
) {
    if (isMergeMessageHubEvent(event)) {
        await processMessage({
            db,
            message: event.mergeMessageBody.message,
            handler,
            deletedMessages: event.mergeMessageBody.deletedMessages,
        })
    } else if (isRevokeMessageHubEvent(event)) {
        await processMessage({
            db,
            message: event.revokeMessageBody.message,
            handler,
        })
    } else if (isPruneMessageHubEvent(event)) {
        await processMessage({
            db,
            message: event.pruneMessageBody.message,
            handler,
        })
    }
}

/**
 * Processes a message.
 * @param {object} args - The arguments object.
 * @param {DB} args.db - The database connection.
 * @param {Message} args.message  - The message to process.
 * @param {MessageHandler} args.handler - The message handler.
 * @param {Message[] | undefined} args.deletedMessages - The deleted messages.
 */
async function processMessage({
    db,
    message,
    handler,
    deletedMessages = [],
}: {
    db: DB
    message: Message
    handler: MessageHandler
    deletedMessages?: Message[]
}) {
    await db.transaction(async (trx) => {
        if (deletedMessages.length > 0) {
            await Promise.all(
                deletedMessages.map(async (deletedMessage) => {
                    await handler.handleMessageMerge({
                        message: deletedMessage,
                        trx,
                    })
                }),
            )
        }
        await handler.handleMessageMerge({
            message,
            trx,
        })
    })
}

/**
 * Processes messages of a given type.
 * @param {object} args - The arguments object.
 * @param {Message[]} args.messages - The messages to process.
 * @param {MessageType} args.type - The message type.
 */
export async function processMessages({
    messages,
    type,
}: {
    messages: Message[]
    type: MessageType
}) {
    await db.transaction(async (trx) => {
        await App.processMessagesOfType({
            messages,
            type,
            trx,
        })
    })
}
