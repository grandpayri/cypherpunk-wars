/**
 * CYPHERPUNK_WARS: CRYPTO_LAYER
 * wallet-gen.js
 */
import init, { Mnemonic, XPrv, PrivateKeyGenerator } from './kaspa.js';

const CPW_NETWORK_ID = "testnet-10";

// Testnet-appropriate shortcut: the mnemonic is kept in sessionStorage (cleared when
// the tab/browser closes, never written to localStorage) so pages loaded later in the
// same session can re-derive the signing key without re-prompting the operator on every
// action. This would need a real encrypted keystore + unlock password before mainnet.
const SESSION_MNEMONIC_KEY = 'bunker_mnemonic_session';

let engineOnline = false;
let bootPromise = null;

// Idempotent and safe to call concurrently from multiple independent call sites (e.g. a
// page's own load handler AND shared-header.js's self-contained prize-vault fetch both
// calling this around the same time) -- dedupes to a single underlying init() rather than
// racing two WASM initializations.
export async function bootBunkerEngine() {
    if (engineOnline) return true;
    if (bootPromise) return bootPromise;

    bootPromise = (async () => {
        try {
            console.log("ENGINE: Locating WASM binaries...");
            await init();
            engineOnline = true;
            console.log("ENGINE: Status 200 - Online");
            return true;
        } catch (err) {
            console.error("WASM_BOOT_FAILURE:", err);
            bootPromise = null; // allow a retry on the next call
            return false;
        }
    })();
    return bootPromise;
}

export function forgeNewIdentity() {
    if (!engineOnline) {
        console.error("FORGE_BLOCKED: Engine Offline");
        return null;
    }
    try {
        const mnemonic = Mnemonic.random(24);
        return mnemonic.phrase;
    } catch (err) {
        console.error("MNEMONIC_GEN_ERROR:", err);
        return null;
    }
}

export function derivePrivateKeyFromMnemonic(mnemonicPhrase) {
    const mnemonic = new Mnemonic(mnemonicPhrase);
    const seed = mnemonic.toSeed();
    const xprv = new XPrv(seed);
    const generator = new PrivateKeyGenerator(xprv, false, 0n);
    return generator.receiveKey(0);
}

export function deriveAddressFromMnemonic(mnemonicPhrase) {
    return derivePrivateKeyFromMnemonic(mnemonicPhrase).toAddress(CPW_NETWORK_ID).toString();
}

// Hex-encoded x-only Schnorr public key (32 bytes) -- the value baked into a player's
// restricted-wallet covenant redeem script so only they can authorize spends.
//
// PublicKey.toString() returns a 33-byte *compressed* key (a leading 0x02/0x03 parity
// byte + the 32-byte body), but Kaspa's native P2PK scripts use the bare 32-byte x-only
// body with no prefix -- confirmed empirically by decoding a known address's own
// scriptPublicKey and round-tripping it against a manually-built OpCheckSig script built
// from just the trimmed 32 bytes (exact match). Strip the prefix here so every caller
// gets the form Kaspa Script actually expects, rather than each call site needing to
// remember to trim it.
export function derivePublicKeyFromMnemonic(mnemonicPhrase) {
    const compressed = derivePrivateKeyFromMnemonic(mnemonicPhrase).toPublicKey().toString();
    return compressed.slice(2);
}

export async function syncBunkerIdentity(mnemonicPhrase) {
    if (!engineOnline) throw new Error("ENGINE_OFFLINE");

    try {
        const bunkerId = deriveAddressFromMnemonic(mnemonicPhrase);
        localStorage.setItem('bunker_id', bunkerId);
        sessionStorage.setItem(SESSION_MNEMONIC_KEY, mnemonicPhrase);
        return bunkerId;
    } catch (err) {
        console.error("IDENTITY_SYNC_ERROR:", err);
        throw err;
    }
}

// Returns the PrivateKey for the current session, re-derived from the sessionStorage
// mnemonic. Throws SESSION_KEY_UNAVAILABLE if the tab/browser was closed and reopened
// (sessionStorage cleared) — callers should catch this and route to a re-entry flow
// (e.g. resume.html asking for the mnemonic again).
export function getSessionPrivateKey() {
    const mnemonicPhrase = sessionStorage.getItem(SESSION_MNEMONIC_KEY);
    if (!mnemonicPhrase) throw new Error("SESSION_KEY_UNAVAILABLE");
    return derivePrivateKeyFromMnemonic(mnemonicPhrase);
}

export function hasSessionKey() {
    return sessionStorage.getItem(SESSION_MNEMONIC_KEY) !== null;
}

// Same re-derivation pattern as getSessionPrivateKey(), for callers that only need the
// public key (e.g. deriving/displaying a restricted-wallet covenant address).
export function getSessionPublicKey() {
    const mnemonicPhrase = sessionStorage.getItem(SESSION_MNEMONIC_KEY);
    if (!mnemonicPhrase) throw new Error("SESSION_KEY_UNAVAILABLE");
    return derivePublicKeyFromMnemonic(mnemonicPhrase);
}
