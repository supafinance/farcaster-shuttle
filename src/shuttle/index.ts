import type { Message } from '@farcaster/hub-nodejs'
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import type { DB } from './db'

export * from './db'
export * from './redis'
export * from './hub'
export * from './hubSubscriber'
export * from './hubEventProcessor'
export * from './messageReconciliation'
export * from './eventStream'

export type StoreMessageOperation = 'merge' | 'delete' | 'revoke' | 'prune'
export type MessageState = 'created' | 'deleted'

export type ProcessResult = {
    skipped: boolean
}

// Implement this interface in your app to handle messages. The package currently provides the following guarantees:
// - Messages can be assumed to be processed in the same order as they were received by the hub as long as wasMissed is false
// - if wasMissed is true, then the package provides no guarantees about the ordering (it is possible to receive an add
//      after a remove, your app needs to handle the CRDT resolution). We will provide a way to handle this in the future.
// - If the same message is received multiple times, isNew will be set to false for all but the first time
// - state is a user-friendly translation of the impact of the message to the CRDT set (e.g. a "merge" of a remove message
// is semantically a delete of the existing add, and state will be set to "deleted" in that case)

export interface MessageHandler {
    handleMessageMerge({
        message,
        trx,
    }: {
        message: Message
        trx: DB | PostgresJsTransaction<any, any>
    }): Promise<void>
}
