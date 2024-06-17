import {
    type HubRpcClient,
    type Message,
    MessageType,
} from '@farcaster/hub-nodejs'
import type { pino } from 'pino'

const MAX_PAGE_SIZE = 3_000

// Ensures that all messages for a given FID are present in the database. Can be used for both backfilling and reconciliation.
export class MessageReconciliation {
    private client: HubRpcClient
    private log: pino.Logger

    constructor({ client, log }: { client: HubRpcClient; log: pino.Logger }) {
        this.client = client
        this.log = log
    }

    async reconcileMessagesForFid(
        fid: number,
        onHubMessage: ({
            message,
            missingInDb,
            prunedInDb,
            revokedInDb,
        }: {
            message: Message
            missingInDb: boolean
            prunedInDb: boolean
            revokedInDb: boolean
        }) => Promise<void>,
    ) {
        for (const type of [
            // MessageType.CAST_ADD,
            MessageType.LINK_ADD,
            MessageType.VERIFICATION_ADD_ETH_ADDRESS,
            MessageType.USER_DATA_ADD,
            MessageType.REACTION_ADD,
        ]) {
            this.log.debug(
                `Reconciling messages for FID ${fid} of type ${type}`,
            )
            await this.reconcileMessagesOfTypeForFid({
                fid,
                type,
                onHubMessage,
            })
            this.log.info(`Reconciled messages for FID ${fid} of type ${type}`)
        }
    }

    async reconcileMessagesOfTypeForFid({
        fid,
        type,
        onHubMessage,
    }: {
        fid: number
        type: MessageType
        onHubMessage: ({
            message,
            missingInDb,
            prunedInDb,
            revokedInDb,
        }: {
            message: Message
            missingInDb: boolean
            prunedInDb: boolean
            revokedInDb: boolean
        }) => Promise<void>
    }) {
        // First, reconcile messages that are in the hub but not in the database
        for await (const messages of this.allHubMessagesOfTypeForFid({
            fid,
            type,
        })) {
            if (messages.length === 0) {
                this.log.info(`No messages of type ${type} for FID ${fid}`)
                continue
            }

            switch (type) {
                case MessageType.CAST_ADD:
                    // this.log.info(
                    //     `Reconciling ${messages.length} cast messages for FID ${fid}`,
                    // )
                    continue
                case MessageType.REACTION_ADD:
                    this.log.info(
                        `Reconciling ${messages.length} reaction messages for FID ${fid}`,
                    )
                    break
                case MessageType.LINK_ADD:
                    this.log.info(
                        `Reconciling ${messages.length} link messages for FID ${fid}`,
                    )
                    break
                case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
                    this.log.info(
                        `Reconciling ${messages.length} verification messages for FID ${fid}`,
                    )
                    break
                case MessageType.USER_DATA_ADD:
                    this.log.info(
                        `Reconciling ${messages.length} user data messages for FID ${fid}`,
                    )
                    break
            }

            for (const message of messages) {
                // always attempt to add to db, and do nothing on conflict
                await onHubMessage({
                    message,
                    missingInDb: true,
                    prunedInDb: false,
                    revokedInDb: false,
                })
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

    private async *allHubMessagesOfTypeForFid({
        fid,
        type,
    }: { fid: number; type: MessageType }) {
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
}
