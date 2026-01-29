// wallet-gen.js - Iteration 9.3 (Trace-Enabled Handshake)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity(traceCallback) {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        const trace = traceCallback || console.log;
        
        trace("TRACE: Checking LocalStorage for existing phrase...");
        let phrase = localStorage.getItem('cpw_mnemonic');

        // 1. FORGE SEQUENCE
        if (!phrase || phrase.length < 10) {
            trace("TRACE: No phrase found. Starting MANUAL_ENTROPY_FORGE...");
            try {
                const entropy = new Uint8Array(32);
                window.crypto.getRandomValues(entropy);
                trace("TRACE: Browser Entropy generated (32 bytes).");
                
                trace("TRACE: Feeding entropy to Mnemonic constructor...");
                const mnemonicObj = new Mnemonic(entropy);
                phrase = mnemonicObj.phrase;

                if (!phrase) throw new Error("CONSTRUCTOR_RETURNED_NULL_PHRASE");
                trace("TRACE: 24-word phrase successfully extracted.");
                
                localStorage.setItem('cpw_mnemonic', phrase);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + phrase);
            } catch (forgeErr) {
                trace(`TRACE_FAULT: Forge phase failed - ${forgeErr.message}`);
                throw new Error(`FORGE_CRASH: ${forgeErr.message}`);
            }
        } else {
            trace("TRACE: Existing phrase detected in storage.");
        }

        // 2. INITIALIZATION SEQUENCE
        try {
            trace("TRACE: Instantiating Mnemonic class from string...");
            const cleanPhrase = String(phrase).trim();
            const mnemonic = new Mnemonic(cleanPhrase);
            
            trace("TRACE: Converting phrase to seed buffer...");
            const seed = await mnemonic.toSeed();
            
            trace("TRACE: Deriving Extended Private Key (xpriv) from seed...");
            const xpriv = ExtendedPrivateKey.fromSeed(seed);
            
            trace("TRACE: Deriving standard Kaspa path (m/44'/111111'/0'/0/0)...");
            const key = xpriv.deriveChild(44, true)
                             .deriveChild(111111, true)
                             .deriveChild(0, true)
                             .deriveChild(0)
                             .deriveChild(0).privateKey;

            trace("TRACE: Converting key to public address string...");
            const address = key.toAddress(this.network).toString();
            
            localStorage.setItem('cpw_addr', address);
            trace(`TRACE_SUCCESS: Identity armed for ${address.substring(0,10)}...`);

            return { address };
        } catch (initErr) {
            trace(`TRACE_FAULT: Initialization failed - ${initErr.message}`);
            // Safety: If the phrase is corrupt, wipe it so we don't loop errors
            localStorage.removeItem('cpw_mnemonic');
            throw new Error(`INIT_CRASH: ${initErr.message}`);
        }
    }
}
