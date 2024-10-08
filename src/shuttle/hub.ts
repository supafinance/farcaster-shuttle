import {
    type HubEvent,
    type HubRpcClient,
    getInsecureHubRpcClient,
    getSSLHubRpcClient,
    isMergeMessageHubEvent,
    isMergeOnChainHubEvent,
    isMergeUsernameProofHubEvent,
    isPruneMessageHubEvent,
    isRevokeMessageHubEvent,
} from '@farcaster/hub-nodejs'
import { bytesToHex } from '../utils'

export type HubClient = {
    host: string
    client: HubRpcClient
}

/**
 * Get a Farcaster hub rpc client.
 * @param {string} host The host of the hub.
 * @param {object} options - The options object.
 * @param {boolean | undefined} options.ssl Whether to use SSL.
 * @returns {HubClient} The hub client.
 */
export function getHubClient(
    host: string,
    { ssl }: { ssl?: boolean },
): { host: string; client: HubRpcClient } {
    const hub = ssl ? getSSLHubRpcClient(host) : getInsecureHubRpcClient(host)
    return { host, client: hub }
}

/**
 * Get the cache key for a hub event.
 * @param {HubEvent} event The hub event.
 * @returns {string} The cache key.
 */
export const getHubEventCacheKey = (event: HubEvent): string => {
    if (isMergeMessageHubEvent(event)) {
        const hash = bytesToHex(event.mergeMessageBody.message.hash)
        const deletedHashes = event.mergeMessageBody.deletedMessages.map(
            (message) => bytesToHex(message.hash),
        )
        return `hub:evt:merge:${[hash, ...deletedHashes].join(':')}`
    }
    if (isRevokeMessageHubEvent(event)) {
        const hash = bytesToHex(event.revokeMessageBody.message.hash)
        return `hub:evt:revoke:${hash}`
    }
    if (isPruneMessageHubEvent(event)) {
        const hash = bytesToHex(event.pruneMessageBody.message.hash)
        return `hub:evt:prune:${hash}`
    }
    if (isMergeUsernameProofHubEvent(event)) {
        if (event.mergeUsernameProofBody.deletedUsernameProof) {
            if (event.mergeUsernameProofBody.deletedUsernameProofMessage) {
                const hash = bytesToHex(
                    event.mergeUsernameProofBody.deletedUsernameProofMessage
                        .hash,
                )
                return `hub:evt:revoke:${hash}`
            }

            const signature = bytesToHex(
                event.mergeUsernameProofBody.deletedUsernameProof.signature,
            )
            return `hub:evt:username:delete:${signature}`
        }

        if (event.mergeUsernameProofBody.usernameProof) {
            if (event.mergeUsernameProofBody.usernameProofMessage) {
                const hash = bytesToHex(
                    event.mergeUsernameProofBody.usernameProofMessage.hash,
                )
                return `hub:evt:merge:${hash}`
            }

            const signature = bytesToHex(
                event.mergeUsernameProofBody.usernameProof.signature,
            )
            return `hub:evt:username:merge:${signature}`
        }
    }
    if (isMergeOnChainHubEvent(event)) {
        const hash = bytesToHex(
            event.mergeOnChainEventBody.onChainEvent.transactionHash,
        )
        const { logIndex } = event.mergeOnChainEventBody.onChainEvent
        return `hub:evt:onchain:${hash}:${event.mergeOnChainEventBody.onChainEvent.type}:${logIndex}`
    }

    // we should never reach here, appease the compiler
    throw new Error('Hub event is missing cache key')
}
