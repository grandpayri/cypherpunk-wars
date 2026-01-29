// wallet-gen.js - Iteration 10.0 (Doc-Compliant)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity(trace) {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        trace("TRACE: AUDITING_LOCAL_STORAGE...");
        let phrase = localStorage.getItem('cpw_mnemonic');

        // 1. FORGE: Use the official static random() method
        if (!phrase || phrase.length < 10) {
            trace("TRACE: STORAGE_EMPTY. INITIATING_OFFICIAL_RANDOM_GENERATION...");
            try {
                // Official SDK way to get 24 words
                const mnemonicObj = Mnemonic.random(24); 
                phrase = mnemonicObj.phrase;

                if (!phrase) throw new Error("SDK_RANDOM_RETURNED_NULL");
                trace("TRACE: OFFICIAL_PHRASE_GENERATED.");
                
                localStorage.setItem('cpw_mnemonic', phrase);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + phrase);
            } catch (forgeErr) {
                trace(`TRACE_FAULT: FORGE_FAILED -> ${forgeErr.message}`);
                throw new Error(`FORGE_CRASH: ${forgeErr.message}`);
            }
        }

        // 2. INITIALIZE: Pass the verified phrase STRING to the engine
        try {
            trace("TRACE: BINDING_PHRASE_STRING_TO_CONSTRUCTOR...");
            // The doc confirms: constructor(phrase: string)
            const cleanPhrase = String(phrase).trim();
            const mnemonic = new Mnemonic(cleanPhrase);
            
            trace("TRACE: GENERATING_SEED_FROM_PHRASE...");
            const seed = await mnemonic.toSeed(); // returns string
            
            trace("TRACE: DERIVING_KEYS_FROM_SEED...");
            // Use the seed string to derive the HD wallet
            const xpriv = ExtendedPrivateKey.fromSeed(seed);
            
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
            throw new Error(`INIT_CRASH: ${initErr.message}`);
        }
    }
}
