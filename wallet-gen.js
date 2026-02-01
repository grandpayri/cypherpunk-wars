/**
 * CYPHERPUNK_WARS: CRYPTO_LAYER
 * wallet-gen.js
 */

// This ensures the WASM global is available
const { Wallet, initKaspaFramework, Mnemonic } = kaspa;
let engineOnline = false;

async function bootBunkerEngine() {
    try {
        console.log("ENGINE: Locating WASM binaries...");
        
        // IMPORTANT: We must await the framework initialization
        // This loads the actual logic into the browser's memory
        await initKaspaFramework(); 
        
        engineOnline = true;
        console.log("ENGINE: Status 200 - Online");
        return true;
    } catch (err) {
        console.error("WASM_BOOT_FAILURE:", err);
        return false;
    }
}

function forgeNewIdentity() {
    if (!engineOnline) {
        console.error("FORGE_BLOCKED: Engine Offline");
        return null;
    }
    try {
        const mnemonic = Mnemonic.random(12);
        return mnemonic.phrase;
    } catch (err) {
        console.error("MNEMONIC_GEN_ERROR:", err);
        return null;
    }
}

async function syncBunkerIdentity(mnemonicPhrase) {
    if (!engineOnline) throw new Error("ENGINE_OFFLINE");
    
    try {
        // networkId: "mainnet" or "testnet-11"
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
        console.error("IDENTITY_SYNC_ERROR:", err);
        throw err;
    }
}
