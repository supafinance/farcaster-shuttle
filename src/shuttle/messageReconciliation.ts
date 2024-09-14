import {
    type HubRpcClient,
    type Message,
    MessageType,
} from '@farcaster/hub-nodejs'
import type { pino } from 'pino'

const MAX_PAGE_SIZE = 3_000

type ReconcileParams = {
    client: HubRpcClient
    log: pino.Logger
    fid: number
    onHubMessage: (messages: Message[], type: MessageType) => Promise<void>
}

export async function reconcileMessagesForFid({
    client,
    log,
    fid,
    onHubMessage,
}: ReconcileParams) {
    for (const type of [
        // MessageType.CAST_ADD,
        MessageType.LINK_ADD,
        MessageType.VERIFICATION_ADD_ETH_ADDRESS,
        MessageType.USER_DATA_ADD,
        MessageType.REACTION_ADD,
    ]) {
        log.debug(`Reconciling messages for FID ${fid} of type ${type}`)
        await reconcileMessagesOfTypeForFid({
            client,
            log,
            fid,
            type,
            onHubMessage,
        })
        log.info(`Reconciled messages for FID ${fid} of type ${type}`)
    }
}

type ReconcileMessagesOfTypeParams = {
    client: HubRpcClient
    log: pino.Logger
    fid: number
    type: MessageType
    onHubMessage: (messages: Message[], type: MessageType) => Promise<void>
}

async function reconcileMessagesOfTypeForFid({
    client,
    log,
    fid,
    type,
    onHubMessage,
}: ReconcileMessagesOfTypeParams) {
    for await (const messages of allHubMessagesOfTypeForFid({
        client,
        fid,
        type,
    })) {
        if (messages.length === 0) {
            log.debug(`No messages of type ${type} for FID ${fid}`)
            continue
        }

        switch (type) {
            case MessageType.CAST_ADD:
                // log.info(`Reconciling ${messages.length} cast messages for FID ${fid}`);
                continue
            case MessageType.REACTION_ADD:
                log.info(
                    `Reconciling ${messages.length} reaction messages for FID ${fid}`,
                )
                break
            case MessageType.LINK_ADD:
                log.info(
                    `Reconciling ${messages.length} link messages for FID ${fid}`,
                )
                break
            case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
                log.info(
                    `Reconciling ${messages.length} verification messages for FID ${fid}`,
                )
                break
            case MessageType.USER_DATA_ADD:
                log.info(
                    `Reconciling ${messages.length} user data messages for FID ${fid}`,
                )
                break
        }

        await onHubMessage(messages, type)
    }

    // todo: Next, reconcile messages that are in the database but not in the hub
}

type AllHubMessagesParams = {
    client: HubRpcClient
    fid: number
    type: MessageType
}

async function* allHubMessagesOfTypeForFid({
    client,
    fid,
    type,
}: AllHubMessagesParams) {
    let fn: any
    switch (type) {
        case MessageType.CAST_ADD:
            // fn = getAllCastMessagesByFidInBatchesOf;
            break
        case MessageType.REACTION_ADD:
            fn = getAllReactionMessagesByFidInBatchesOf
            break
        case MessageType.LINK_ADD:
            fn = getAllLinkMessagesByFidInBatchesOf
            break
        case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
            fn = getAllVerificationMessagesByFidInBatchesOf
            break
        case MessageType.USER_DATA_ADD:
            fn = getAllUserDataMessagesByFidInBatchesOf
            break
        default:
            throw `Unknown message type ${type}`
    }
    for await (const messages of fn({ client, fid, pageSize: MAX_PAGE_SIZE })) {
        yield messages as Message[]
    }
}

type GetAllMessagesParams = {
    client: HubRpcClient
    fid: number
    pageSize: number
}

async function* getAllReactionMessagesByFidInBatchesOf({
    client,
    fid,
    pageSize,
}: GetAllMessagesParams) {
    let result = await client.getAllReactionMessagesByFid({ pageSize, fid })
    for (;;) {
        if (result.isErr()) {
            throw new Error(
                `Unable to get all reactions for FID ${fid}: ${result.error?.message}`,
            )
        }

        const { messages, nextPageToken: pageToken } = result.value

        yield messages

        if (!pageToken?.length) break
        result = await client.getAllReactionMessagesByFid({
            pageSize,
            pageToken,
            fid,
        })
    }
}

async function* getAllLinkMessagesByFidInBatchesOf({
    client,
    fid,
    pageSize,
}: GetAllMessagesParams) {
    let result = await client.getAllLinkMessagesByFid({ pageSize, fid })
    for (;;) {
        if (result.isErr()) {
            throw new Error(
                `Unable to get all links for FID ${fid}: ${result.error?.message}`,
            )
        }

        const { messages, nextPageToken: pageToken } = result.value

        yield messages

        if (!pageToken?.length) break
        result = await client.getAllLinkMessagesByFid({
            pageSize,
            pageToken,
            fid,
        })
    }
}

async function* getAllVerificationMessagesByFidInBatchesOf({
    client,
    fid,
    pageSize,
}: GetAllMessagesParams) {
    let result = await client.getAllVerificationMessagesByFid({ pageSize, fid })
    for (;;) {
        if (result.isErr()) {
            throw new Error(
                `Unable to get all verifications for FID ${fid}: ${result.error?.message}`,
            )
        }

        const { messages, nextPageToken: pageToken } = result.value

        yield messages

        if (!pageToken?.length) break
        result = await client.getAllVerificationMessagesByFid({
            pageSize,
            pageToken,
            fid,
        })
    }
}

async function* getAllUserDataMessagesByFidInBatchesOf({
    client,
    fid,
    pageSize,
}: GetAllMessagesParams) {
    let result = await client.getAllUserDataMessagesByFid({ pageSize, fid })
    for (;;) {
        if (result.isErr()) {
            throw new Error(
                `Unable to get all user data messages for FID ${fid}: ${result.error?.message}`,
            )
        }

        const { messages, nextPageToken: pageToken } = result.value

        yield messages

        if (!pageToken?.length) break
        result = await client.getAllUserDataMessagesByFid({
            pageSize,
            pageToken,
            fid,
        })
    }
}
