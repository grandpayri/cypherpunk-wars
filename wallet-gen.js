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

export async function bootBunkerEngine() {
    try {
        console.log("ENGINE: Locating WASM binaries...");
        await init();
        engineOnline = true;
        console.log("ENGINE: Status 200 - Online");
        return true;
    } catch (err) {
        console.error("WASM_BOOT_FAILURE:", err);
        return false;
    }
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
