// wallet-gen.js - Iteration 9.7 (Entropy-First)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity(trace) {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        trace("TRACE: AUDITING_STORAGE...");
        let storedPhrase = localStorage.getItem('cpw_mnemonic');
        let mnemonic;

        try {
            if (!storedPhrase) {
                trace("TRACE: NO_STORED_PHRASE. GENERATING_ENTROPY...");
                // Generate 32 bytes of raw entropy
                const entropy = new Uint8Array(32);
                window.crypto.getRandomValues(entropy);
                
                trace("TRACE: INITIALIZING_MNEMONIC_FROM_BINARY...");
                // Most WASM builds prefer entropy (Uint8Array) over strings
                mnemonic = new Mnemonic(entropy);
                storedPhrase = mnemonic.phrase;
                localStorage.setItem('cpw_mnemonic', storedPhrase);
            } else {
                trace("TRACE: RESTORING_FROM_STRING...");
                mnemonic = new Mnemonic(storedPhrase);
            }

            trace("TRACE: GENERATING_SEED_BUFFER...");
            const seed = await mnemonic.toSeed();
            
            trace("TRACE: DERIVING_EXTENDED_KEY...");
            const xpriv = ExtendedPrivateKey.fromSeed(seed);
            
            trace("TRACE: DERIVING_KASPA_PATH...");
            const key = xpriv.deriveChild(44, true)
                             .deriveChild(111111, true)
                             .deriveChild(0, true)
                             .deriveChild(0)
                             .deriveChild(0).privateKey;

            const address = key.toAddress(this.network).toString();
            localStorage.setItem('cpw_addr', address);
            
            trace(`TRACE_SUCCESS: IDENTITY_ARMED -> ${address.substring(0,10)}...`);
            return { address };

        } catch (initErr) {
            trace(`TRACE_FAULT: INIT_FAILED -> ${initErr.message}`);
            // If it fails, clear storage so we don't loop on bad data
            localStorage.removeItem('cpw_mnemonic');
            throw new Error(`INIT_CRASH: ${initErr.message}`);
        }
    }
}
