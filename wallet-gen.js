/**
 * CYPHERPUNK WARS: IDENTITY FORGE (wallet-gen.js)
 * High-performance WASM identity management.
 */

const { Wallet, initKaspaFramework, Mnemonic } = kaspa;
let engineOnline = false;

/**
 * BOOT ENGINE: Initializes the WASM framework.
 */
async function bootBunkerEngine() {
    try {
        console.log("ENGINE: Initializing Kaspa WASM...");
        await initKaspaFramework();
        engineOnline = true;
        console.log("ENGINE: Framework Online.");
        return true;
    } catch (err) {
        console.error("BOOT_ERROR:", err);
        return false;
    }
}

/**
 * FORGE NEW IDENTITY: Generates a secure 12-word phrase.
 */
function forgeNewIdentity() {
    if (!engineOnline) return "ERROR: ENGINE_OFFLINE";
    try {
        const mnemonic = Mnemonic.random(12);
        return mnemonic.phrase; 
    } catch (err) {
        console.error("FORGE_ERROR:", err);
        return null;
    }
}

/**
 * SYNC IDENTITY: Derives the Bunker ID.
 */
async function syncBunkerIdentity(mnemonicPhrase) {
    if (!engineOnline) throw new Error("ENGINE_OFFLINE");
    try {
        const wallet = await Wallet.fromMnemonic(
            mnemonicPhrase,
            { networkId: "mainnet" }
        );
        const account = await wallet.getAccount(0);
        const address = await account.receive.getAddress(0);
        
        const bunkerId = address.toString();
        localStorage.setItem('bunker_id', bunkerId);
        return bunkerId;
    } catch (err) {
        console.error("SYNC_ERROR:", err);
        throw err;
    }
}
