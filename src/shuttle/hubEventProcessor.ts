import {
    type HubEvent,
    type Message,
    type MessageType,
    isMergeMessageHubEvent,
    isPruneMessageHubEvent,
    isRevokeMessageHubEvent,
} from '@farcaster/hub-nodejs'
import { App } from '../app.ts'
import type { MessageHandler } from './'
import type { DB } from './db'

export async function processHubEvent(
    db: DB,
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

export async function processMessages({
    db,
    messages,
    type,
}: {
    db: DB
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
