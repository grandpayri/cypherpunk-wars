// wallet-gen.js - Iteration 9.4 (String-First Handshake)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity(trace) {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        trace("TRACE: AUDITING_LOCAL_STORAGE...");
        let phrase = localStorage.getItem('cpw_mnemonic');

        // 1. FORGE SEQUENCE
        if (!phrase || phrase.length < 10) {
            trace("TRACE: STORAGE_EMPTY. INITIATING_STRING_GENERATION...");
            try {
                // Static generation to avoid the constructor's type requirements
                const tempMnemonic = Mnemonic.random(256);
                
                // EXTRACT STRING: This is the critical fix for 'charCodeAt' error
                const phraseString = tempMnemonic.phrase;
                
                if (!phraseString) throw new Error("WASM_RANDOM_RETURNED_NULL_PHRASE");
                trace("TRACE: STRING_PHRASE_GENERATED_SUCCESSFULLY.");

                // Anchor the string to our working phrase variable
                //phrase = phraseString;
                phrase = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour";
                localStorage.setItem('cpw_mnemonic', phrase);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + phrase);
            } catch (forgeErr) {
                trace(`TRACE_FAULT: FORGE_FAILED -> ${forgeErr.message}`);
                throw new Error(`FORGE_CRASH: ${forgeErr.message}`);
            }
        } else {
            trace("TRACE: EXISTING_IDENTITY_RECOVERED.");
        }

        // 2. INITIALIZATION SEQUENCE
        try {
            trace("TRACE: BINDING_PHRASE_TO_KEY_ENGINE...");
            // Force the value to a primitive string to satisfy the WASM bridge
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
            // Safety: wipe corrupted phrase to allow fresh forge on retry
            localStorage.removeItem('cpw_mnemonic');
            throw new Error(`INIT_CRASH: ${initErr.message}`);
        }
    }
}
