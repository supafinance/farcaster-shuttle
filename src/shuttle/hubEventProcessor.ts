import {
    type HubEvent,
    type Message,
    isCastAddMessage,
    isCastRemoveMessage,
    isLinkAddMessage,
    isLinkRemoveMessage,
    isMergeMessageHubEvent,
    isPruneMessageHubEvent,
    isReactionAddMessage,
    isReactionRemoveMessage,
    isRevokeMessageHubEvent,
    isVerificationAddAddressMessage,
    isVerificationRemoveMessage,
} from '@farcaster/hub-nodejs'
import type { MessageHandler, MessageState, StoreMessageOperation } from './'
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
            operation: 'merge',
            deletedMessages: event.mergeMessageBody.deletedMessages,
        })
    } else if (isRevokeMessageHubEvent(event)) {
        await processMessage({
            db,
            message: event.revokeMessageBody.message,
            handler,
            operation: 'revoke',
        })
    } else if (isPruneMessageHubEvent(event)) {
        await processMessage({
            db,
            message: event.pruneMessageBody.message,
            handler,
            operation: 'prune',
        })
    }
}

export async function handleMissingMessage(
    db: DB,
    message: Message,
    handler: MessageHandler,
) {
    await processMessage({
        db,
        message,
        handler,
        operation: 'merge',
        wasMissed: true,
    })
}

export function getMessageState(
    message: Message,
    operation: StoreMessageOperation,
): MessageState {
    const isAdd = operation === 'merge'
    // Casts
    if (isAdd && isCastAddMessage(message)) {
        return 'created'
    }
    if (
        (isAdd && isCastRemoveMessage(message)) ||
        (!isAdd && isCastAddMessage(message))
    ) {
        return 'deleted'
    }
    // Links
    if (isAdd && isLinkAddMessage(message)) {
        return 'created'
    }
    if (
        (isAdd && isLinkRemoveMessage(message)) ||
        (!isAdd && isLinkAddMessage(message))
    ) {
        return 'deleted'
    }
    // Reactions
    if (isAdd && isReactionAddMessage(message)) {
        return 'created'
    }
    if (
        (isAdd && isReactionRemoveMessage(message)) ||
        (!isAdd && isReactionAddMessage(message))
    ) {
        return 'deleted'
    }
    // Verifications
    if (isAdd && isVerificationAddAddressMessage(message)) {
        return 'created'
    }
    if (
        (isAdd && isVerificationRemoveMessage(message)) ||
        (!isAdd && isVerificationAddAddressMessage(message))
    ) {
        return 'deleted'
    }

    // The above are 2p sets, so we have the consider whether they are add or remove messages to determine the state
    // The rest are 1p sets, so we can just check the operation

    return isAdd ? 'created' : 'deleted'
}

async function processMessage({
    db,
    message,
    handler,
    operation,
    deletedMessages = [],
    wasMissed = false,
}: {
    db: DB
    message: Message
    handler: MessageHandler
    operation: StoreMessageOperation
    deletedMessages?: Message[]
    wasMissed?: boolean
}) {
    await db.transaction(async (trx) => {
        if (deletedMessages.length > 0) {
            await Promise.all(
                deletedMessages.map(async (deletedMessage) => {
                    const state = getMessageState(deletedMessage, 'delete')
                    await handler.handleMessageMerge({
                        message: deletedMessage,
                        txn: trx,
                        operation: 'delete',
                        state,
                        wasMissed,
                    })
                }),
            )
        }
        const state = getMessageState(message, operation)
        await handler.handleMessageMerge({
            message,
            txn: trx,
            operation,
            state,
            wasMissed,
        })
    })
}
