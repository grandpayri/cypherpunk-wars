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
import { RpcClient, Resolver, Generator, ScriptBuilder, Opcodes, createTransaction, addressFromScriptPublicKey, payToAddressScript, payToScriptHashSignatureScript, SighashType } from './kaspa.js';

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

// Client-side courtesy check only -- the faucet covenant itself has no memory and doesn't
// enforce one-grant-per-address (see the "Known, accepted limitation" note above
// FAUCET_GRANT_CAP_SOMPI's usage in the plan doc: rate-limited but not sybil-resistant).
// This just stops OUR OWN UI (forge.html) from handing out a second grant to an address
// that's already received one -- a determined player could still bypass it by calling
// requestFaucetGrant() directly. Checks the target address's own recent transaction
// history (not the faucet's, which would grow unbounded over the game's lifetime) for any
// incoming transaction whose input traces back to FAUCET_VAULT_ADDRESS.
export async function hasReceivedFaucetGrant(address) {
    const url = `${REST_API_BASE}/addresses/${encodeURIComponent(address)}/full-transactions?limit=50&resolve_previous_outpoints=light`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`INDEXER_REQUEST_FAILED: ${resp.status}`);
    const txs = await resp.json();
    return txs.some((tx) => (tx.inputs || []).some((input) => input.previous_outpoint_address === FAUCET_VAULT_ADDRESS));
}

const MAGIC = "CPW1";

export const ActionType = Object.freeze({
    GENESIS: 0x01,
    PHISH: 0x02,
    ATTACK: 0x03,     // reserved, Phase 7 -- not wired up yet
    RESEARCH: 0x04,   // reserved, Phase 6 -- not wired up yet
    HACK: 0x05,       // reserved, Phase 7 (includes Armageddon casts) -- not wired up yet
    BUY_TURNS: 0x06,  // reserved -- buyTurns() doesn't tag a payload yet, open question
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

// State-snapshot payload, not just an action tag: every Genesis/Phish payload's extraBytes
// carries the operator's *entire* current game state at that point (not a delta), so an
// indexer can read it directly off an operator's most recent transaction instead of
// replaying their whole history. Fixed-width, versioned struct -- see the plan doc's
// "Extended economics & payload design" section (1a) for the full field-by-field rationale.
// Every slot not yet backed by real gameplay is written as 0, same honesty convention
// already used for $PUNKW before Phish existed.
export const GAME_STATE_SCHEMA_VERSION = 1;
export const GAME_STATE_BODY_BYTES = 42;

export const NodeSpecialization = Object.freeze({
    UNSET: 0,
    CONSENSUS: 1,
    INFRASTRUCTURE: 2,
    OVERCLOCKING: 3,
    PHANTOM: 4,
    DARKNET: 5,
});

// Fixed roster order -- matches documentation/design-bible.md section 02.
export const UNIT_TYPES = [
    'whiteHatProxies', 'mainframeBricks', 'scrapingScripts', 'botnetsSleeperAgents', 'aiSentinels',
];
// Fixed roster order -- matches documentation/design-bible.md section 04.
export const ITEM_TYPES = [
    'botnetDrive', 'overclockFirmware', 'thermalPasteSyringe', 'compromisedRoutingLedger', 'firewallDegradants',
];

export function encodeGameStateSnapshot(state = {}) {
    const buf = new ArrayBuffer(GAME_STATE_BODY_BYTES);
    const view = new DataView(buf);
    let o = 0;
    view.setUint8(o, GAME_STATE_SCHEMA_VERSION); o += 1;
    view.setBigUint64(o, BigInt(state.punkw ?? 0), true); o += 8;
    view.setUint16(o, state.sectors ?? 0, true); o += 2;
    view.setUint8(o, state.nodeSpec ?? NodeSpecialization.UNSET); o += 1;
    view.setUint8(o, state.researchTier ?? 0); o += 1;
    view.setUint32(o, state.turnCount ?? 0, true); o += 4;
    view.setUint16(o, state.season ?? 0, true); o += 2;
    for (const key of UNIT_TYPES) {
        view.setUint16(o, state.units?.[key] ?? 0, true); o += 2;
    }
    for (const key of ITEM_TYPES) {
        view.setUint8(o, state.items?.[key] ?? 0); o += 1;
    }
    // remaining bytes (reserved trailer) left zeroed by ArrayBuffer's default init
    return new Uint8Array(buf);
}

export function decodeGameStateSnapshot(extraBytes) {
    if (!extraBytes || extraBytes.length < GAME_STATE_BODY_BYTES) return null;
    const view = new DataView(extraBytes.buffer, extraBytes.byteOffset, extraBytes.byteLength);
    let o = 0;
    const schemaVersion = view.getUint8(o); o += 1;
    if (schemaVersion !== GAME_STATE_SCHEMA_VERSION) return null;
    const punkw = Number(view.getBigUint64(o, true)); o += 8;
    const sectors = view.getUint16(o, true); o += 2;
    const nodeSpec = view.getUint8(o); o += 1;
    const researchTier = view.getUint8(o); o += 1;
    const turnCount = view.getUint32(o, true); o += 4;
    const season = view.getUint16(o, true); o += 2;
    const units = {};
    for (const key of UNIT_TYPES) { units[key] = view.getUint16(o, true); o += 2; }
    const items = {};
    for (const key of ITEM_TYPES) { items[key] = view.getUint8(o); o += 1; }
    return { schemaVersion, punkw, sectors, nodeSpec, researchTier, turnCount, season, units, items };
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

// Real fee margin for the ~40-50 byte CPW1 payload's contribution to compute mass
// (confirmed live: a zero-priorityFee Genesis attempt was rejected with "transaction has
// 50000 fees which is under the required amount of 203600 for compute mass 2036").
const PAYLOAD_FEE_BUFFER_SOMPI = 300000n;

// *** PAYLOAD TAGGING HISTORY -- read this before touching payload code. ***
//
// Payload tagging was broken, then disabled, then fixed, all on 2026-07-10:
//
// 1. `pendingTransaction.transaction` returns a FRESH CLONE on every access (confirmed:
//    `a !== b` for two consecutive reads) -- setting `.payload` on it mutates a disposable
//    clone that's discarded immediately. No error, payload silently never reached what got
//    signed/submitted. This was the original, previously-undiagnosed reason CPW History
//    showed every real Phish/Genesis move as "non-CPW transaction": nothing this game ever
//    broadcast actually carried a payload on-chain.
// 2. Fix attempt #1: pass `payload` directly into `Generator`'s own settings instead. This
//    DID attach real payload bytes to the resulting transaction (`tx.payload` correctly
//    reflected it) -- but broke signing entirely ("script ran, but verification failed" /
//    "false stack entry"), on both the covenant-signed Phish path and a plain Genesis send
//    using the SDK's own built-in `.sign()`. Root cause traced to the transaction's `.mass`
//    being IDENTICAL with or without payload (confirmed: two otherwise-identical builds
//    both reported mass 50721, byte-for-byte, across `Generator`'s own calc,
//    `updateTransactionMass()`, and `calculateTransactionMass()`) -- the vendored SDK
//    (`kaspa.js`'s `version()` reported **0.15.2**) was simply too old: rusty-kaspa's PR
//    #591, "Enable payloads for non coinbase transactions," didn't land until v0.15.4-rc1.
//    Payload tagging was reverted/disabled as an emergency fix (commit `9d3bd92`) to
//    restore gameplay, which had broken outright for real players.
// 3. Actual fix: upgraded the vendored `kaspa.js`/`kaspa_bg.wasm` to **v2.0.1** (the
//    current stable release, matching what this project's node/network already targets).
//    Confirmed live on testnet-10 with a disposable throwaway keypair (funded via the
//    faucet covenant, no real player credentials touched): mnemonic-to-address derivation
//    is byte-for-byte unchanged (critical -- this is what would have orphaned every
//    existing player's identity had it differed), and payload-bearing Genesis/Phish
//    transactions now sign and broadcast correctly, with mass genuinely differing with vs.
//    without payload (the concrete signal the original bug is actually fixed this time).
//    Payload tagging is back on below. If this ever breaks again, check the SDK version
//    first (`import('./kaspa.js').then(m => m.version())`) before re-diagnosing from
//    scratch -- there's a good chance it's the same class of issue.

// Builds, signs, and broadcasts a transaction tagged with a CPW action payload.
// privateKey must be able to sign for fromAddress's UTXOs (see wallet-gen.js's
// getSessionPrivateKey()).
//
// Uses the Generator class (not the low-level createTransaction()) specifically so
// leftover UTXO value is correctly returned to fromAddress as change instead of being
// consumed entirely as network fee.
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
        payload: encodePayload(actionType, extraBytes),
    });

    let pendingTransaction;
    let txid;
    while ((pendingTransaction = await generator.next())) {
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
// hosting their own instance can redirect this by changing FEE_RATE_BP/FEE_MIN_SOMPI/
// HOST_FEE_ADDRESS below.
//
// Faucet and host each take the GREATER of a hard 0.5 KAS floor or 0.5% of the deposit --
// below 100 KAS deposited, 0.5% would round to less than the ~0.5 KAS a single output
// needs to clear this transaction shape's KIP-9 storage-mass floor (confirmed empirically
// in Phase 4.6), so the flat floor applies instead. The two regimes meet exactly at 100
// KAS (0.5% of 100 KAS == 0.5 KAS), so there's no discontinuity at the crossover.
export const FEE_MIN_SOMPI = 50000000n; // 0.5 KAS floor, each side
const FEE_RATE_BP = 50n; // 0.5%, in basis points out of 10000
export const HOST_FEE_ADDRESS = REGISTRY_ADDRESS;

// Single source of truth for the faucet/host/vault split on a given gross deposit --
// used by buyTurns() itself and by send.html's live cost-preview, so the two can never
// drift apart.
export function computeBuyTurnsBreakdown(depositAmountSompi) {
    const scaledCut = (depositAmountSompi * FEE_RATE_BP) / 10000n;
    const cut = scaledCut > FEE_MIN_SOMPI ? scaledCut : FEE_MIN_SOMPI;
    return { faucet: cut, host: cut, vault: depositAmountSompi - cut - cut };
}

// Inverts computeBuyTurnsBreakdown: given a desired number of turns, returns the gross
// deposit that leaves at least that many turns' worth of $KAS in the vault after the
// faucet/host cuts. Ceiling-divides so the vault never ends up a few sompi short of the
// target due to integer rounding.
export function computeDepositForTurns(turnsRequested) {
    const targetVault = BigInt(turnsRequested) * COST_PER_TURN_SOMPI;
    const crossoverDeposit = 100n * 100000000n; // 100 KAS -- where 0.5% == FEE_MIN_SOMPI
    const belowCrossoverDeposit = targetVault + FEE_MIN_SOMPI * 2n;
    if (belowCrossoverDeposit <= crossoverDeposit) {
        return belowCrossoverDeposit;
    }
    // Above the crossover: targetVault = deposit * (1 - 2*rate), solved for deposit,
    // rounded up so re-deriving the breakdown from this deposit never falls short.
    const denominator = 10000n - FEE_RATE_BP * 2n;
    return (targetVault * 10000n + denominator - 1n) / denominator;
}

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
// recognizes). Build the transaction shape via the Generator (which correctly finalizes
// mass internally, including payload, on the current SDK -- see the "PAYLOAD TAGGING
// HISTORY" note above sendTaggedTransaction), then take over signing manually instead of
// calling pendingTransaction.sign().
async function buildRestrictedWalletSpend({ playerAddress, playerPubkeyHex, outputs, priorityFee, payload }) {
    const rpc = await connectRpc();
    const { entries } = await rpc.getUtxosByAddresses([playerAddress]);
    if (!entries || entries.length === 0) {
        throw new Error("NO_UTXOS_AVAILABLE");
    }

    const generatorSettings = {
        entries,
        changeAddress: playerAddress,
        outputs,
        priorityFee,
        networkId: CPW_NETWORK_ID,
    };
    if (payload) generatorSettings.payload = payload;

    const generator = new Generator(generatorSettings);
    const pendingTransaction = await generator.next();
    return { rpc, pendingTransaction, redeemScriptHex: buildRestrictedWalletRedeemScript(playerPubkeyHex).toString() };
}

// Uses PendingTransaction's own createInputSignature(index, key, sighashType)/
// fillInput(index, signatureScript) methods, which operate directly on its internal state
// (with correct UTXO-entry context) -- NOT the free-function createInputSignature(tx, ...)
// + a `.transaction` clone, which lacks that context and (separately from the payload bug
// above) is the less-correct API for this regardless. Confirmed working live for a
// no-payload spend.
function signRestrictedWalletSpend(pendingTransaction, playerPrivateKey, redeemScriptHex) {
    const inputCount = pendingTransaction.transaction.inputs.length; // read-only count, safe
    for (let i = 0; i < inputCount; i++) {
        const sigHex = pendingTransaction.createInputSignature(i, playerPrivateKey, SighashType.All);
        pendingTransaction.fillInput(i, payToScriptHashSignatureScript(redeemScriptHex, sigHex));
    }
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
        payload: encodePayload(actionType, extraBytes),
    });

    signRestrictedWalletSpend(pendingTransaction, playerPrivateKey, redeemScriptHex);

    const changeOutput = pendingTransaction.transaction.outputs[1]; // read-only, informational
    const txid = await pendingTransaction.submit(rpc);
    return {
        txid,
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

    signRestrictedWalletSpend(pendingTransaction, playerPrivateKey, redeemScriptHex);

    // Expected to throw here -- the RPC rejection message is the demo's actual payload.
    return await pendingTransaction.submit(rpc);
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
// outputs (vault gets the bulk, faucet vault and host each get their scaling cut -- see
// computeBuyTurnsBreakdown) plus the Generator's own auto-change back to fromAddress for
// whatever wasn't committed to this deposit.
export async function buyTurns({ fromAddress, privateKey, vaultAddress, depositAmountSompi, priorityFee = 500000n }) {
    const { faucet, host, vault: vaultAmount } = computeBuyTurnsBreakdown(depositAmountSompi);
    if (vaultAmount < FEE_MIN_SOMPI) {
        throw new Error(`DEPOSIT_TOO_SMALL: need at least ${faucet + host + FEE_MIN_SOMPI} sompi`);
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
            { address: FAUCET_VAULT_ADDRESS, amount: faucet },
            { address: HOST_FEE_ADDRESS, amount: host },
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
    return { txid, breakdown: { vault: vaultAmount, faucet, host } };
}

// --- CPW History (Phase 5 groundwork) ---
//
// Two data sources, neither alone sufficient, combined here:
// 1. The community-run testnet-10 REST indexer (api-tn10.kaspa.org) has a full historical
//    transaction list per address (real txids/timestamps/amounts, reaching back to an
//    address's first transaction) -- but it runs simply-kaspa-indexer with
//    --exclude-fields=tx_payload (confirmed empirically: every payload comes back null,
//    even with ?fields=payload requested explicitly), so it can never decode a move.
// 2. Direct RPC (rpc.getBlock) DOES return real payload bytes (confirmed empirically
//    against this same indexer's own transaction_id/block_hash) -- but Kaspa nodes prune
//    old blocks, so this only reaches back a limited window (confirmed empirically: 3 of 8
//    ~4-day-old test blocks already came back "cannot find header" against the resolver's
//    node). This mirrors the K-Kluster/Kasia messaging app's own architecture: their README
//    describes their own indexer as "not required" for live use but needed for historical
//    catch-up, for the same underlying reason.
//
// So: use the REST indexer for the list, then best-effort RPC for each entry's payload --
// decodes fully for anything recent, degrades to "undecodable" once a block's been pruned.
const REST_API_BASE = "https://api-tn10.kaspa.org";

function hexToBytes(hex) {
    if (!hex) return new Uint8Array(0);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

// Real, indexer-backed list -- works for any address, arbitrarily far back, but carries
// no payload data (see above). blockTime is epoch-millis.
export async function fetchAddressTransactionList(address, limit = 25) {
    const url = `${REST_API_BASE}/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&resolve_previous_outpoints=no`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`INDEXER_REQUEST_FAILED: ${resp.status}`);
    const txs = await resp.json();
    return txs.map((tx) => ({
        txid: tx.transaction_id,
        blockHash: tx.block_hash?.[0] ?? null,
        blockTime: tx.block_time ?? null,
        outputs: tx.outputs ?? [],
    }));
}

// Best-effort: returns the raw payload bytes for one transaction via direct RPC.
// Returns `undefined` (distinct from an empty/zero-length Uint8Array!) if the node has
// already pruned that block or the transaction couldn't be located -- an expected,
// aging-dependent gap the caller should render as "undecodable", not a real failure.
// A transaction that resolves fine but genuinely has no payload (not a CPW1 transaction
// at all) correctly returns a zero-length Uint8Array, NOT undefined -- callers must not
// conflate "couldn't check" with "checked, and there's nothing there".
export async function fetchTransactionPayloadBytes(txid, blockHash) {
    if (!blockHash) return undefined;
    const rpc = await connectRpc();
    let result;
    try {
        result = await rpc.getBlock({ hash: blockHash, includeTransactions: true });
    } catch (err) {
        return undefined; // pruned ("cannot find header") or otherwise unreachable
    }
    const tx = (result.block?.transactions || []).find((t) => t.verboseData?.transactionId === txid);
    if (!tx) return undefined;
    return hexToBytes(tx.payload);
}
