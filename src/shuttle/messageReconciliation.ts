import {
    type HubRpcClient,
    type Message,
    MessageType,
} from '@farcaster/hub-nodejs'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { pino } from 'pino'
import { type Hex, toHex } from 'viem'
import { messages as messagesTable } from '../lib/drizzle/schema.ts'
import type { DB } from './db'

const MAX_PAGE_SIZE = 3_000

type DBMessage = {
    hash: Hex | null
    prunedAt: string | null
    revokedAt: string | null
    fid: string
    type: MessageType | number
    raw: string | null
    signer: Hex | null
}

// Ensures that all messages for a given FID are present in the database. Can be used for both backfilling and reconciliation.
export class MessageReconciliation {
    private client: HubRpcClient
    private db: DB
    private log: pino.Logger

    constructor(client: HubRpcClient, db: DB, log: pino.Logger) {
        this.client = client
        this.db = db
        this.log = log
    }

    async reconcileMessagesForFid(
        fid: number,
        onHubMessage: (
            message: Message,
            missingInDb: boolean,
            prunedInDb: boolean,
            revokedInDb: boolean,
        ) => Promise<void>,
        // onDbMessage?: (
        //     message: DBMessage,
        //     missingInHub: boolean,
        // ) => Promise<void>,
    ) {
        for (const type of [
            MessageType.CAST_ADD,
            MessageType.REACTION_ADD,
            MessageType.LINK_ADD,
            MessageType.VERIFICATION_ADD_ETH_ADDRESS,
            MessageType.USER_DATA_ADD,
        ]) {
            this.log.info(`Reconciling messages for FID ${fid} of type ${type}`)
            await this.reconcileMessagesOfTypeForFid(
                fid,
                type,
                onHubMessage,
                // onDbMessage,
            )
        }
    }

    async reconcileMessagesOfTypeForFid(
        fid: number,
        type: MessageType,
        onHubMessage: (
            message: Message,
            missingInDb: boolean,
            prunedInDb: boolean,
            revokedInDb: boolean,
        ) => Promise<void>,
        // onDbMessage?: (
        //     message: DBMessage,
        //     missingInHub: boolean,
        // ) => Promise<void>,
    ) {
        // todo: Username proofs, and on chain events

        const hubMessagesByHash: Record<string, Message> = {}
        // First, reconcile messages that are in the hub but not in the database
        for await (const messages of this.allHubMessagesOfTypeForFid(
            fid,
            type,
        )) {
            const messageHashes = messages.map((msg) => toHex(msg.hash))

            if (messageHashes.length === 0) {
                this.log.info(`No messages of type ${type} for FID ${fid}`)
                continue
            }

            switch (type) {
                case MessageType.CAST_ADD:
                    this.log.info(
                        `Reconciling ${messageHashes.length} cast messages for FID ${fid}`,
                    )
                    break
                case MessageType.REACTION_ADD:
                    this.log.info(
                        `Reconciling ${messageHashes.length} reaction messages for FID ${fid}`,
                    )
                    break
                case MessageType.LINK_ADD:
                    this.log.info(
                        `Reconciling ${messageHashes.length} link messages for FID ${fid}`,
                    )
                    break
                case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
                    this.log.info(
                        `Reconciling ${messageHashes.length} verification messages for FID ${fid}`,
                    )
                    break
                case MessageType.USER_DATA_ADD:
                    this.log.info(
                        `Reconciling ${messageHashes.length} user data messages for FID ${fid}`,
                    )
                    break
            }

            // const dbMessages = await this.db
            //     .select({
            //         prunedAt: messagesTable.prunedAt,
            //         revokedAt: messagesTable.revokedAt,
            //         hash: messagesTable.hash,
            //         fid: messagesTable.fid,
            //         type: messagesTable.type,
            //         raw: messagesTable.raw,
            //     })
            //     .from(messagesTable)
            //     .where(inArray(messagesTable.hash, messageHashes))
            //     .execute()
            //
            // const dbMessageHashes = dbMessages.reduce(
            //     (acc, msg) => {
            //         if (msg.hash === null) {
            //             return acc
            //         }
            //         const key = toHex(msg.hash)
            //         acc[key] = msg
            //         return acc
            //     },
            //     {} as Record<
            //         string,
            //         Pick<
            //             MessageRow,
            //             | 'revokedAt'
            //             | 'prunedAt'
            //             | 'fid'
            //             | 'type'
            //             | 'hash'
            //             | 'raw'
            //         >
            //     >,
            // )

            for (const message of messages) {
                const msgHashKey = Buffer.from(message.hash).toString('hex')
                hubMessagesByHash[msgHashKey] = message

                await onHubMessage(message, true, false, false)
                // const dbMessage = dbMessageHashes[msgHashKey]
                // if (dbMessage === undefined) {
                //     await onHubMessage(message, true, false, false)
                // } else {
                //     let wasPruned = false
                //     let wasRevoked = false
                //     if (dbMessage?.prunedAt) {
                //         wasPruned = true
                //     }
                //     if (dbMessage?.revokedAt) {
                //         wasRevoked = true
                //     }
                //     await onHubMessage(message, false, wasPruned, wasRevoked)
                // }
            }
        }

        // // todo: Next, reconcile messages that are in the database but not in the hub
        // const dbMessages = await this.allActiveDbMessagesOfTypeForFid(fid, type)
        // for (const dbMessage of dbMessages) {
        //     if (dbMessage.hash === null) {
        //         continue
        //     }
        //     const key = toHex(dbMessage.hash)
        //     await onDbMessage?.(dbMessage, !hubMessagesByHash[key])
        // }
    }

    private async *allHubMessagesOfTypeForFid(fid: number, type: MessageType) {
        let fn: any
        switch (type) {
            case MessageType.CAST_ADD:
                fn = this.getAllCastMessagesByFidInBatchesOf
                break
            case MessageType.REACTION_ADD:
                fn = this.getAllReactionMessagesByFidInBatchesOf
                break
            case MessageType.LINK_ADD:
                fn = this.getAllLinkMessagesByFidInBatchesOf
                break
            case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
                fn = this.getAllVerificationMessagesByFidInBatchesOf
                break
            case MessageType.USER_DATA_ADD:
                fn = this.getAllUserDataMessagesByFidInBatchesOf
                break
            default:
                throw `Unknown message type ${type}`
        }
        for await (const messages of fn.call(this, fid, MAX_PAGE_SIZE)) {
            yield messages as Message[]
        }
    }

    private async *getAllCastMessagesByFidInBatchesOf(
        fid: number,
        pageSize: number,
    ) {
        let result = await this.client.getAllCastMessagesByFid({
            pageSize,
            fid,
        })
        for (;;) {
            if (result.isErr()) {
                throw new Error(
                    `Unable to get all casts for FID ${fid}: ${result.error?.message}`,
                )
            }

            const { messages, nextPageToken: pageToken } = result.value

            yield messages

            if (!pageToken?.length) break
            result = await this.client.getAllCastMessagesByFid({
                pageSize,
                pageToken,
                fid,
            })
        }
    }

    private async *getAllReactionMessagesByFidInBatchesOf(
        fid: number,
        pageSize: number,
    ) {
        let result = await this.client.getAllReactionMessagesByFid({
            pageSize,
            fid,
        })
        for (;;) {
            if (result.isErr()) {
                throw new Error(
                    `Unable to get all reactions for FID ${fid}: ${result.error?.message}`,
                )
            }

            const { messages, nextPageToken: pageToken } = result.value

            yield messages

            if (!pageToken?.length) break
            result = await this.client.getAllReactionMessagesByFid({
                pageSize,
                pageToken,
                fid,
            })
        }
    }

    private async *getAllLinkMessagesByFidInBatchesOf(
        fid: number,
        pageSize: number,
    ) {
        let result = await this.client.getAllLinkMessagesByFid({
            pageSize,
            fid,
        })
        for (;;) {
            if (result.isErr()) {
                throw new Error(
                    `Unable to get all links for FID ${fid}: ${result.error?.message}`,
                )
            }

            const { messages, nextPageToken: pageToken } = result.value

            yield messages

            if (!pageToken?.length) break
            result = await this.client.getAllLinkMessagesByFid({
                pageSize,
                pageToken,
                fid,
            })
        }
    }

    private async *getAllVerificationMessagesByFidInBatchesOf(
        fid: number,
        pageSize: number,
    ) {
        let result = await this.client.getAllVerificationMessagesByFid({
            pageSize,
            fid,
        })
        for (;;) {
            if (result.isErr()) {
                throw new Error(
                    `Unable to get all verifications for FID ${fid}: ${result.error?.message}`,
                )
            }

            const { messages, nextPageToken: pageToken } = result.value

            yield messages

            if (!pageToken?.length) break
            result = await this.client.getAllVerificationMessagesByFid({
                pageSize,
                pageToken,
                fid,
            })
        }
    }

    private async *getAllUserDataMessagesByFidInBatchesOf(
        fid: number,
        pageSize: number,
    ) {
        let result = await this.client.getAllUserDataMessagesByFid({
            pageSize,
            fid,
        })
        for (;;) {
            if (result.isErr()) {
                throw new Error(
                    `Unable to get all user data messages for FID ${fid}: ${result.error?.message}`,
                )
            }

            const { messages, nextPageToken: pageToken } = result.value

            yield messages

            if (!pageToken?.length) break
            result = await this.client.getAllUserDataMessagesByFid({
                pageSize,
                pageToken,
                fid,
            })
        }
    }

    private allActiveDbMessagesOfTypeForFid(fid: number, type: MessageType) {
        let typeSet: MessageType[] = [type]
        // Add remove types for messages which support them
        switch (type) {
            case MessageType.CAST_ADD:
                typeSet = [...typeSet, MessageType.CAST_REMOVE]
                break
            case MessageType.REACTION_ADD:
                typeSet = [...typeSet, MessageType.REACTION_REMOVE]
                break
            case MessageType.LINK_ADD:
                typeSet = [
                    ...typeSet,
                    MessageType.LINK_REMOVE,
                    MessageType.LINK_COMPACT_STATE,
                ]
                break
            case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
                typeSet = [...typeSet, MessageType.VERIFICATION_REMOVE]
                break
        }

        return this.db
            .select({
                prunedAt: messagesTable.prunedAt,
                revokedAt: messagesTable.revokedAt,
                hash: messagesTable.hash,
                fid: messagesTable.fid,
                type: messagesTable.type,
                raw: messagesTable.raw,
                signer: messagesTable.signer,
            })
            .from(messagesTable)
            .where(
                and(
                    eq(messagesTable.fid, String(fid)),
                    inArray(messagesTable.type, typeSet),
                    isNull(messagesTable.prunedAt),
                    isNull(messagesTable.revokedAt),
                    isNull(messagesTable.deletedAt),
                ),
            )
            .execute()
    }
}
