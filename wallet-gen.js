/**
 * CYPHERPUNK WARS: IDENTITY FORGE (wallet-gen.js)
 * High-performance WASM identity management based on Kaspa SDK standards.
 */

// Global access to SDK classes
const { Wallet, initKaspaFramework, Mnemonic } = kaspa;

/**
 * BOOT ENGINE: Initializes the WASM framework.
 * This must resolve before any crypto actions occur.
 */
async function bootBunkerEngine() {
    try {
        console.log("ENGINE: Initializing Kaspa WASM Framework...");
        await initKaspaFramework();
        console.log("ENGINE: Framework Online.");
        return true;
    } catch (err) {
        console.error("BOOT_ERROR: Engine failed to start.", err);
        return false;
    }
}

/**
 * FORGE NEW IDENTITY: Generates a secure 12-word BIP39 phrase.
 */
function forgeNewIdentity() {
    try {
        const mnemonic = Mnemonic.random(12);
        console.log("FORGE: New Identity Generated.");
        return mnemonic.phrase; 
    } catch (err) {
        console.error("FORGE_ERROR: Generation failed.", err);
        return null;
    }
}

/**
 * SYNC IDENTITY: Converts a mnemonic string into a Sovereign Bunker ID.
 * This pattern avoids the 'charCodeAt' error by using the Wallet class wrapper.
 */
async function syncBunkerIdentity(mnemonicPhrase) {
    try {
        console.log("SYNC: Deriving Bunker ID from mnemonic...");
        
        // Use the Wallet class to handle the binary conversion
        const wallet = await Wallet.fromMnemonic(
            mnemonicPhrase,
            { networkId: "mainnet" }
        );

        const account = await wallet.getAccount(0);
        const address = await account.receive.getAddress(0);
        
        const bunkerId = address.toString();
        
        // Persistence: Store the ID but NOT the mnemonic for security
        localStorage.setItem('bunker_id', bunkerId);
        
        return bunkerId;
    } catch (err) {
        console.error("SYNC_ERROR: Invalid Mnemonic or SDK mismatch.", err);
        throw err;
    }
}
