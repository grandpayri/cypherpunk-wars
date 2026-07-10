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
import { RpcClient, Resolver, Generator, ScriptBuilder, Opcodes, createTransaction, addressFromScriptPublicKey, payToAddressScript, createInputSignature, payToScriptHashSignatureScript, SighashType } from './kaspa.js';

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
    PHISH: 0x02,
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
    return entries.reduce((sum, e) => sum + BigInt(e.amount), 0n);
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

// --- Restricted-spend player wallet (per-player covenant) ---
//
// Unlike the faucet vault (a communal covenant needing no signature), this covenant is
// derived per-player from their own public key: only that player can authorize a spend
// (via a real OP_CHECKSIGVERIFY), but the covenant *also* restricts what a valid spend can
// look like. This is what makes "faucet funds can only be used on CPW transactions" a real,
// network-enforced guarantee rather than a UI convention: a plain send from this address
// (any shape other than the one below) fails script verification regardless of how valid
// the signature is.
//
// Reuses only opcodes already proven live by the faucet vault above (output count/amount/
// spk introspection, self-referencing change) plus OpCheckSigVerify, a standard pre-Toccata
// opcode -- deliberately avoids the payload-inspection opcodes (OpTxPayloadLen/Substr)
// since their exact stack semantics were never actually exercised in this codebase.
//
// Phase 4.6 economics redesign: the 3-way fee split moved OUT of this per-turn script and
// into buyTurns() below (charged once when funding the vault, not on every single turn) --
// each Phish transaction now only pays the reward treasury directly, a plain 2-output shape
// (tag + change) that clears the ~0.2 KAS single-output KIP-9 floor from Phase 4, instead of
// needing 0.5 KAS/output like the old 4-output shape did. Turn cost: ~1.505 KAS -> ~0.5 KAS.

// Adjustable creator/host fee, explicitly called out per the game's design notes: a fork
// hosting their own instance can redirect this by changing these two constants.
export const FAUCET_CONTRIB_SOMPI = 50000000n; // 0.5 KAS -- refills the faucet vault, charged at vault top-up time (see buyTurns)
export const HOST_FEE_SOMPI = 50000000n; // 0.5 KAS -- charged at vault top-up time (see buyTurns)
export const HOST_FEE_ADDRESS = REGISTRY_ADDRESS;

// The per-turn tagged amount -- back to the Phase 4 single-output floor now that the
// per-turn spend is a plain 2-output shape (reward treasury + change), not 4 outputs.
export const PHISH_REWARD_AMOUNT_SOMPI = 20000000n; // 0.2 KAS

// Reward treasury ("prize vault" in earlier notes -- same address, same purpose: season
// prize pool). A single fixed P2SH address, locked by a plain OP_CHECKSIG against the
// registry wallet's own pubkey. Deliberately minimal for this phase -- it's a genuine
// script-locked address (not a plain wallet address), but the algorithmic top-N-payout
// logic is still future work (see the roadmap's Phase 7 notes). Nothing spends from it in
// this phase, so it only needs to safely accumulate funds. Now funded two ways: directly by
// every Phish transaction (below), and indirectly never by buyTurns (that splits to faucet/
// host only, not the treasury -- gameplay itself feeds the prize pool, not funding it).
export const PRIZE_VAULT_ADDRESS = "kaspatest:pr9r88pnpwgfc9xn7j8vspu8xx6v4gvr5drywt5lvvdum3rgeqle6l5hw0jev";

// Lazily computed and memoized on first use, NOT at module load time -- payToAddressScript()
// calls into the WASM engine, which isn't initialized yet when this module is first
// imported (bootBunkerEngine()'s init() runs later, on page load). Computing these eagerly
// as top-level consts throws "Cannot read properties of undefined
// (reading '__wbindgen_add_to_stack_pointer')" -- caught via an in-browser smoke test
// before this ever reached forge.html/bunker.html.
// OpTxOutputSpk/OpTxInputSpk push the *full* serialized ScriptPublicKey (a 2-byte
// version field, observed as 0x0000 for standard scripts, followed by the script bytes),
// not just the bare script bytes .script returns -- confirmed empirically after an
// initial version-less attempt was rejected on-chain with "script ran, but verification
// failed" (valid opcodes, wrong comparison value). ScriptPublicKey.version/.script
// confirm the struct has both fields (kaspa.js:8603-8652); this reconstructs the same
// wire format for comparison literals.
let _rewardTreasurySpkHex = null;
function getRewardTreasurySpkHex() {
    if (!_rewardTreasurySpkHex) {
        _rewardTreasurySpkHex = "0000" + payToAddressScript(PRIZE_VAULT_ADDRESS).script;
    }
    return _rewardTreasurySpkHex;
}

// playerPubkeyHex must be the 32-byte x-only hex from wallet-gen.js's
// derivePublicKeyFromMnemonic()/getSessionPublicKey() -- NOT PublicKey.toString()'s raw
// 33-byte compressed form, which includes a parity prefix byte Kaspa's native P2PK/
// OpCheckSig scripts don't use (confirmed by decoding a known address's own
// scriptPublicKey and round-tripping it against a manually-built script).
function buildRestrictedWalletRedeemScript(playerPubkeyHex) {
    const rewardTreasurySpk = getRewardTreasurySpkHex();
    return new ScriptBuilder()
        .addData(playerPubkeyHex).addOp(Opcodes.OpCheckSigVerify)
        .addOp(OpTxOutputCount).addI64(2n).addOp(Opcodes.OpEqual).addOp(Opcodes.OpVerify)
        .addI64(0n).addOp(OpTxOutputSpk).addData(rewardTreasurySpk).addOp(Opcodes.OpEqual).addOp(Opcodes.OpVerify)
        .addI64(0n).addOp(OpTxOutputAmount).addI64(PHISH_REWARD_AMOUNT_SOMPI).addOp(Opcodes.OpEqual).addOp(Opcodes.OpVerify)
        .addOp(OpTxInputIndex).addOp(OpTxInputSpk)
        .addI64(1n).addOp(OpTxOutputSpk)
        .addOp(Opcodes.OpEqual);
}

export function deriveRestrictedWalletAddress(playerPubkeyHex) {
    const redeemScript = buildRestrictedWalletRedeemScript(playerPubkeyHex);
    const spk = redeemScript.createPayToScriptHashScript();
    return addressFromScriptPublicKey(spk, CPW_NETWORK_ID).toString();
}

// Same KIP-9 storage-mass reasoning as PAYLOAD_FEE_BUFFER_SOMPI above -- covers the
// payload's extra compute mass on top of this covenant's (now just 2-output) spend shape.
const RESTRICTED_WALLET_PRIORITY_FEE_SOMPI = 500000n;

// Exported so every page that needs to display/compute "turns available" (currently
// bunker.html and shared-sidebar.js) shares one definition instead of recomputing it.
export const COST_PER_TURN_SOMPI = PHISH_REWARD_AMOUNT_SOMPI + RESTRICTED_WALLET_PRIORITY_FEE_SOMPI;

// Manually signing a P2SH covenant input needs raw createTransaction() + createInputSignature()
// (the Generator's own .sign() only knows how to do standard P2PK signing for addresses it
// recognizes). But raw createTransaction() explicitly does "no mass limit checks" -- when a
// payload is attached afterward, the resulting signature silently stops matching what the
// network verifies against (confirmed empirically: identical setup succeeds with no payload,
// then fails with "script ran, but verification failed" / "false stack entry" once a payload
// is added, even after manually calling updateTransactionMass() first). The fix: build the
// transaction shape via the Generator (which correctly finalizes mass internally, the same
// path sendTaggedTransaction already relies on), set payload on the resulting
// pendingTransaction.transaction, and ONLY THEN take over signing manually -- instead of
// calling pendingTransaction.sign(). This was verified working live on testnet-10 before
// being wired in here.
async function buildRestrictedWalletSpend({ playerAddress, playerPubkeyHex, outputs, priorityFee }) {
    const rpc = await connectRpc();
    const { entries } = await rpc.getUtxosByAddresses([playerAddress]);
    if (!entries || entries.length === 0) {
        throw new Error("NO_UTXOS_AVAILABLE");
    }

    const generator = new Generator({
        entries,
        changeAddress: playerAddress,
        outputs,
        priorityFee,
        networkId: CPW_NETWORK_ID,
    });
    const pendingTransaction = await generator.next();
    return { rpc, pendingTransaction, redeemScriptHex: buildRestrictedWalletRedeemScript(playerPubkeyHex).toString() };
}

function signRestrictedWalletSpend(pendingTransaction, playerPrivateKey, redeemScriptHex) {
    const tx = pendingTransaction.transaction;
    for (let i = 0; i < tx.inputs.length; i++) {
        const sigHex = createInputSignature(tx, i, playerPrivateKey, SighashType.All);
        tx.inputs[i].signatureScript = payToScriptHashSignatureScript(redeemScriptHex, sigHex);
    }
    return tx;
}

// The real Phish-shaped spend: one atomic transaction that writes the CPW game-state
// payload on-chain AND pays the reward treasury, with change returning to the same
// restricted wallet (added automatically by the Generator as output 1, since the tagged
// output below doesn't consume the full input). playerPrivateKey/playerPubkeyHex must
// belong to the same player who controls playerAddress (see wallet-gen.js).
export async function spendFromRestrictedWallet({ playerAddress, playerPrivateKey, playerPubkeyHex, actionType, extraBytes }) {
    const { rpc, pendingTransaction, redeemScriptHex } = await buildRestrictedWalletSpend({
        playerAddress,
        playerPubkeyHex,
        outputs: [{ address: PRIZE_VAULT_ADDRESS, amount: PHISH_REWARD_AMOUNT_SOMPI }],
        priorityFee: RESTRICTED_WALLET_PRIORITY_FEE_SOMPI,
    });

    pendingTransaction.transaction.payload = encodePayload(actionType, extraBytes);
    const tx = signRestrictedWalletSpend(pendingTransaction, playerPrivateKey, redeemScriptHex);

    const changeOutput = tx.outputs[1];
    const result = await rpc.submitTransaction({ transaction: tx, allowOrphan: false });
    return {
        txid: result.transactionId,
        outputs: {
            reward: PHISH_REWARD_AMOUNT_SOMPI,
            change: changeOutput ? changeOutput.value : 0n,
        },
    };
}

// Deliberately non-compliant: builds a plain [destination, change] spend from the
// restricted wallet using an arbitrary destination/amount instead of the required
// reward-treasury shape. The signature is genuinely valid, but the covenant's structural
// checks aren't satisfied, so the network is expected to reject this at the
// script-verification stage -- that rejection (not a client-side refusal) is the actual
// point of this function, used by the Send demo.
export async function attemptRestrictedWalletSend({ playerAddress, playerPrivateKey, playerPubkeyHex, destAddress, amountSompi, priorityFee = 500000n }) {
    const { rpc, pendingTransaction, redeemScriptHex } = await buildRestrictedWalletSpend({
        playerAddress,
        playerPubkeyHex,
        outputs: [{ address: destAddress, amount: amountSompi }],
        priorityFee,
    });

    const tx = signRestrictedWalletSpend(pendingTransaction, playerPrivateKey, redeemScriptHex);

    // Expected to throw here -- the RPC rejection message is the demo's actual payload.
    const result = await rpc.submitTransaction({ transaction: tx, allowOrphan: false });
    return result.transactionId;
}

// Ordinary P2PK send from the player's plain wallet address -- no covenant involved,
// works exactly like any standard Kaspa wallet send. Used by send.html's "Plain Wallet"
// source option, and as the real "send KAS to any address" feature from the wallet-features
// backlog.
export async function sendFromPlainWallet({ fromAddress, privateKey, destAddress, amountSompi, priorityFee = 500000n }) {
    const rpc = await connectRpc();
    const { entries } = await rpc.getUtxosByAddresses([fromAddress]);
    if (!entries || entries.length === 0) {
        throw new Error("NO_UTXOS_AVAILABLE");
    }

    const generator = new Generator({
        entries,
        changeAddress: fromAddress,
        outputs: [{ address: destAddress, amount: amountSompi }],
        priorityFee,
        networkId: CPW_NETWORK_ID,
    });

    let pendingTransaction;
    let txid;
    while ((pendingTransaction = await generator.next())) {
        await pendingTransaction.sign([privateKey]);
        txid = await pendingTransaction.submit(rpc);
    }
    return txid;
}

// "Buying turns": the player funds their own gameplay vault from their plain wallet, and
// this single transaction is where the faucet/host cut now gets paid (moved here from the
// old per-turn covenant spend -- see the Phase 4.6 notes above buildRestrictedWalletRedeemScript).
// No covenant needed on the sending side -- it's the player's own unrestricted plain wallet,
// spending its own funds needs no restriction, just like sendFromPlainWallet. 3 explicit
// outputs (vault gets the bulk, faucet vault and host each get their fixed cut) plus the
// Generator's own auto-change back to fromAddress for whatever wasn't committed to this
// deposit.
const MIN_VAULT_CONTRIBUTION_SOMPI = 50000000n; // 0.5 KAS -- keeps the vault's own cut above the KIP-9 floor too

export async function buyTurns({ fromAddress, privateKey, vaultAddress, depositAmountSompi, priorityFee = 500000n }) {
    const cutsTotal = FAUCET_CONTRIB_SOMPI + HOST_FEE_SOMPI;
    const vaultAmount = depositAmountSompi - cutsTotal;
    if (vaultAmount < MIN_VAULT_CONTRIBUTION_SOMPI) {
        throw new Error(`DEPOSIT_TOO_SMALL: need at least ${cutsTotal + MIN_VAULT_CONTRIBUTION_SOMPI} sompi`);
    }

    const rpc = await connectRpc();
    const { entries } = await rpc.getUtxosByAddresses([fromAddress]);
    if (!entries || entries.length === 0) {
        throw new Error("NO_UTXOS_AVAILABLE");
    }

    const generator = new Generator({
        entries,
        changeAddress: fromAddress,
        outputs: [
            { address: vaultAddress, amount: vaultAmount },
            { address: FAUCET_VAULT_ADDRESS, amount: FAUCET_CONTRIB_SOMPI },
            { address: HOST_FEE_ADDRESS, amount: HOST_FEE_SOMPI },
        ],
        priorityFee,
        networkId: CPW_NETWORK_ID,
    });

    let pendingTransaction;
    let txid;
    while ((pendingTransaction = await generator.next())) {
        await pendingTransaction.sign([privateKey]);
        txid = await pendingTransaction.submit(rpc);
    }
    return { txid, breakdown: { vault: vaultAmount, faucet: FAUCET_CONTRIB_SOMPI, host: HOST_FEE_SOMPI } };
}
