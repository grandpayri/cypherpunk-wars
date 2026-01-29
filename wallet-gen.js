// wallet-gen.js - Iteration 9.3 (Manual Entropy & Trace)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity(trace) {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        trace("TRACE: AUDITING_LOCAL_STORAGE...");
        let phrase = localStorage.getItem('cpw_mnemonic');

        // 1. FORGE: Generate manually if storage is empty
        if (!phrase || phrase.length < 10) {
            trace("TRACE: STORAGE_EMPTY. INITIATING_MANUAL_FORGE...");
            try {
                // Generate 32 bytes (256 bits) of raw entropy manually
                const entropy = new Uint8Array(32);
                window.crypto.getRandomValues(entropy);
                trace("TRACE: BROWSER_ENTROPY_ACQUIRED.");
                
                // Convert entropy to a 24-word phrase via Constructor
                trace("TRACE: BINDING_ENTROPY_TO_WASM_CONSTRUCTOR...");
                const mnemonicObj = new Mnemonic(entropy);
                phrase = mnemonicObj.phrase;

                if (!phrase) throw new Error("WASM_CONSTRUCTOR_RETURNED_NULL");
                trace("TRACE: 24_WORD_PHRASE_VERIFIED.");
                
                localStorage.setItem('cpw_mnemonic', phrase);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + phrase);
            } catch (forgeErr) {
                trace(`TRACE_FAULT: FORGE_FAILED -> ${forgeErr.message}`);
                throw new Error(`FORGE_CRASH: ${forgeErr.message}`);
            }
        } else {
            trace("TRACE: EXISTING_IDENTITY_RECOVERED.");
        }

        // 2. INITIALIZE: Pass the verified phrase string to the engine
        try {
            trace("TRACE: BINDING_PHRASE_TO_KEY_ENGINE...");
            const cleanPhrase = String(phrase).trim();
            const mnemonic = new Mnemonic(cleanPhrase);
            
            trace("TRACE: GENERATING_SEED_BUFFER...");
            const seed = await mnemonic.toSeed();
            
            trace("TRACE: DERIVING_EXTENDED_KEY...");
            const xpriv = ExtendedPrivateKey.fromSeed(seed);
            
            trace("TRACE: DERIVING_KASPA_PATH_M/44'/111111'/0'/0/0...");
            const key = xpriv.deriveChild(44, true)
                             .deriveChild(111111, true)
                             .deriveChild(0, true)
                             .deriveChild(0)
                             .deriveChild(0).privateKey;

            trace("TRACE: ENCODING_PUBLIC_ADDRESS...");
            const address = key.toAddress(this.network).toString();
            
            localStorage.setItem('cpw_addr', address);
            trace(`TRACE_SUCCESS: IDENTITY_ARMED -> ${address.substring(0,10)}...`);

            return { address };
        } catch (initErr) {
            trace(`TRACE_FAULT: INIT_FAILED -> ${initErr.message}`);
            // If the phrase is corrupt, we must clear it to allow a fresh forge
            localStorage.removeItem('cpw_mnemonic');
            throw new Error(`INIT_CRASH: ${initErr.message}`);
        }
    }
}
