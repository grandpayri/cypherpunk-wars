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
import { RpcClient, Resolver, Generator, ScriptBuilder, Opcodes, createTransaction, addressFromScriptPublicKey } from './kaspa.js';

export const CPW_NETWORK_ID = "testnet-10";

// Fixed, well-known address every Genesis transaction pays into. Anyone can discover
// all operators by reading this address's transaction history (see leaderboard.js).
export const REGISTRY_ADDRESS = "kaspatest:qrgtl9dfseyvydnwuj3sqjq5recfcdxt8f9e8p0mlrvx3jfaqj3jqep87s4mm";

// --- Faucet covenant vault ---
// A Toccata covenant (KIP-10 introspection opcodes), NOT a plain address -- funded once
// from the registry treasury (4500 TKAS) and self-perpetuating from then on. The redeem
// script requires no signature at all: anyone (including this client, with no private
// key) can trigger a grant as long as the resulting transaction has exactly 2 outputs,
// the grant output is <= FAUCET_GRANT_CAP_SOMPI, and the change output returns to this
// same covenant script. Verified live on testnet-10: a compliant spend is accepted, and
// one that misdirects the change is rejected by the network with "false stack entry at
// end of script execution" -- real script-engine enforcement, not just convention.
//
// These opcodes aren't yet named in this SDK's `Opcodes` export (checked: our vendored
// kaspa.js and the freshest official v2.0.1 download both lack them), so the numeric
// values below are taken directly from rusty-kaspa's source
// (crypto/txscript/src/wasm/opcodes.rs) rather than guessed.
const OpTxOutputCount = 0xb4;
const OpTxOutputAmount = 0xc2;
const OpTxInputIndex = 0xb9;
const OpTxInputSpk = 0xbf;
const OpTxOutputSpk = 0xc3;

export const FAUCET_GRANT_CAP_SOMPI = 1000000000n; // 10 KAS per grant, matches the vault's own script
export const FAUCET_VAULT_ADDRESS = "kaspatest:pp3ca46urjyyx6jhc6xsu4xj2pdvzvltyk2r0lvaslv806hnjefa77293fg20";

function buildFaucetRedeemScript() {
    return new ScriptBuilder()
        .addOp(OpTxOutputCount).addI64(2n).addOp(Opcodes.OpEqual).addOp(Opcodes.OpVerify)
        .addI64(0n).addOp(OpTxOutputAmount).addI64(FAUCET_GRANT_CAP_SOMPI).addOp(Opcodes.OpLessThanOrEqual).addOp(Opcodes.OpVerify)
        .addOp(OpTxInputIndex).addOp(OpTxInputSpk)
        .addI64(1n).addOp(OpTxOutputSpk)
        .addOp(Opcodes.OpEqual);
}

// Requests a starter grant from the faucet vault for a brand-new player -- no private
// key needed, since the covenant itself (not a signature) authorizes the spend.
export async function requestFaucetGrant(destAddress, grantAmountSompi = FAUCET_GRANT_CAP_SOMPI, priorityFee = 500000n) {
    if (grantAmountSompi > FAUCET_GRANT_CAP_SOMPI) {
        throw new Error(`GRANT_EXCEEDS_CAP: requested ${grantAmountSompi}, cap is ${FAUCET_GRANT_CAP_SOMPI}`);
    }

    const rpc = await connectRpc();
    const { entries } = await rpc.getUtxosByAddresses([FAUCET_VAULT_ADDRESS]);
    if (!entries || entries.length === 0) {
        throw new Error("FAUCET_VAULT_EMPTY");
    }

    const totalInput = entries.reduce((sum, e) => sum + BigInt(e.amount), 0n);
    const changeAmount = totalInput - grantAmountSompi - priorityFee;
    if (changeAmount < 0n) {
        throw new Error("FAUCET_VAULT_INSUFFICIENT_FOR_FEE");
    }

    const redeemScript = buildFaucetRedeemScript();
    const redeemScriptHex = redeemScript.toString();

    const tx = createTransaction(
        entries,
        [
            { address: destAddress, amount: grantAmountSompi },
            { address: FAUCET_VAULT_ADDRESS, amount: changeAmount },
        ],
        priorityFee,
        undefined,
        undefined
    );

    const sigScriptHex = new ScriptBuilder().addData(redeemScriptHex).toString();
    for (let i = 0; i < tx.inputs.length; i++) {
        tx.inputs[i].signatureScript = sigScriptHex;
    }

    const result = await rpc.submitTransaction({ transaction: tx, allowOrphan: false });
    return result.transactionId;
}

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
