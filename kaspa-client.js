/**
 * CYPHERPUNK_WARS: CHAIN_CLIENT
 * kaspa-client.js
 *
 * Shared RPC connection plus the payload wire format used to tag game actions onto
 * Kaspa transactions. Real Kaspa has no Bitcoin-style OP_RETURN; instead every
 * transaction carries a native `payload` byte field (Transaction.payload), which is
 * what this uses. "vprogs" (mentioned in this game's own lore docs) are a real but
 * not-yet-live Kaspa roadmap concept -- nothing here depends on them existing.
 */
import { RpcClient, Resolver, Generator } from './kaspa.js';

export const CPW_NETWORK_ID = "testnet-10";

// Fixed, well-known address every Genesis transaction pays into. Anyone can discover
// all operators by reading this address's transaction history (see leaderboard.js).
export const REGISTRY_ADDRESS = "kaspatest:qrgtl9dfseyvydnwuj3sqjq5recfcdxt8f9e8p0mlrvx3jfaqj3jqep87s4mm";

const MAGIC = "CPW1";

export const ActionType = Object.freeze({
    GENESIS: 0x01,
});

export function encodePayload(actionType, extraBytes = new Uint8Array(0)) {
    const magicBytes = new TextEncoder().encode(MAGIC);
    const payload = new Uint8Array(magicBytes.length + 1 + extraBytes.length);
    payload.set(magicBytes, 0);
    payload[magicBytes.length] = actionType;
    payload.set(extraBytes, magicBytes.length + 1);
    return payload;
}

export function decodePayload(bytes) {
    if (!bytes || bytes.length < 5) return null;
    const magic = new TextDecoder().decode(bytes.slice(0, 4));
    if (magic !== MAGIC) return null;
    return { actionType: bytes[4], extra: bytes.slice(5) };
}

let rpcClient = null;

// Real players don't run their own node, so the shipped game connects via the SDK's
// Resolver, which finds a public community-run testnet-10 node automatically. (A local
// dev node was used earlier for initial wiring/testing but isn't what ships.)
export async function connectRpc() {
    if (rpcClient && rpcClient.isConnected) return rpcClient;
    rpcClient = new RpcClient({
        resolver: new Resolver(),
        networkId: CPW_NETWORK_ID,
    });
    await rpcClient.connect();
    return rpcClient;
}

export async function getAddressBalance(address) {
    const rpc = await connectRpc();
    const { entries } = await rpc.getUtxosByAddresses([address]);
    return entries.reduce((sum, e) => sum + BigInt(e.utxoEntry.amount), 0n);
}

// Confirmed live against the real network: the Generator's settings object does not
// account for a payload set afterward on the resulting transaction -- a zero-priorityFee
// Genesis attempt was rejected with "transaction has 50000 fees which is under the
// required amount of 203600 for compute mass 2036" (the ~40-byte CPW1 payload pushed
// real mass above what the Generator estimated with no payload). This default buffer
// comfortably covers that gap for small payloads; bump it further if a larger payload
// (e.g. richer Phish/Attack data) gets rejected the same way.
const PAYLOAD_FEE_BUFFER_SOMPI = 300000n;

// Builds, signs, and broadcasts a transaction tagged with a CPW action payload.
// privateKey must be able to sign for fromAddress's UTXOs (see wallet-gen.js's
// getSessionPrivateKey()).
//
// Uses the Generator class (not the low-level createTransaction()) specifically so
// leftover UTXO value is correctly returned to fromAddress as change instead of being
// consumed entirely as network fee. The payload is set directly on the resulting
// PendingTransaction's underlying Transaction before signing, since the Generator's
// settings object doesn't accept a payload field itself (see PAYLOAD_FEE_BUFFER_SOMPI).
export async function sendTaggedTransaction({ fromAddress, privateKey, toAddress, amountSompi, priorityFee = PAYLOAD_FEE_BUFFER_SOMPI, actionType, extraBytes }) {
    const rpc = await connectRpc();
    const { entries } = await rpc.getUtxosByAddresses([fromAddress]);
    if (!entries || entries.length === 0) {
        throw new Error("NO_UTXOS_AVAILABLE");
    }

    const generator = new Generator({
        entries,
        changeAddress: fromAddress,
        outputs: [{ address: toAddress, amount: amountSompi }],
        priorityFee,
        networkId: CPW_NETWORK_ID,
    });

    const payload = encodePayload(actionType, extraBytes);
    let pendingTransaction;
    let txid;
    while ((pendingTransaction = await generator.next())) {
        pendingTransaction.transaction.payload = payload;
        await pendingTransaction.sign([privateKey]);
        txid = await pendingTransaction.submit(rpc);
    }
    return txid;
}
