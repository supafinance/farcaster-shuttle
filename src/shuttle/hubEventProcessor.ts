import {
    type HubEvent,
    type Message,
    isMergeMessageHubEvent,
    isPruneMessageHubEvent,
    isRevokeMessageHubEvent,
} from '@farcaster/hub-nodejs'
import { App } from '../app.ts'
import { log } from '../log.ts'
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
}: {
    db: DB
    messages: Message[]
}) {
    await db.transaction(async (trx) => {
        for (const message of messages) {
            if (message.data?.type) {
                await App.processMessagesOfType({
                    messages: [message],
                    type: message.data?.type,
                    trx,
                })
            }
        }
    })

    log.warn(`Processed ${messages.length} messages`)
}

// export async function processMessages({
//     db,
//     messages,
// }: {
//     db: DB
//     messages: Message[]
// }) {
//     await db.transaction(async (trx) => {
//         await Promise.all(
//             messages.map(async (message) => {
//                 if (message.data?.type) {
//                     await App.processMessagesOfType({
//                         messages: [message],
//                         type: message.data?.type,
//                         trx,
//                     })
//                 }
//             }),
//         )
//     })
//
//     log.warn(`Processed ${messages.length} messages`)
// }
