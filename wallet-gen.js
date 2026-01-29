// wallet-gen.js - Iteration 9.6 (Static Method Bypass)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity(trace) {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        trace("TRACE: AUDITING_STORAGE...");
        // For testing, we will keep your hardcoded phrase if storage is empty
        let phrase = localStorage.getItem('cpw_mnemonic') || "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour";

        try {
            trace("TRACE: BINDING_PHRASE_VIA_STATIC_METHOD...");
            
            // Syntax Bypass: Many WASM builds prefer Mnemonic.fromPhrase over 'new'
            // This avoids the 'charCodeAt' bridge error
            let mnemonic;
            const cleanPhrase = phrase.trim();
            
            try {
                // Try the static factory first
                mnemonic = Mnemonic.fromPhrase(cleanPhrase);
                trace("TRACE: SUCCESS via Mnemonic.fromPhrase()");
            } catch (e) {
                // Fallback to the constructor only if the factory doesn't exist
                trace("TRACE: fromPhrase missing, trying constructor fallback...");
                mnemonic = new Mnemonic(cleanPhrase);
            }
            
            trace("TRACE: GENERATING_SEED...");
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
            
            localStorage.setItem('cpw_mnemonic', cleanPhrase);
            localStorage.setItem('cpw_addr', address);
            
            trace(`TRACE_SUCCESS: IDENTITY_ARMED -> ${address.substring(0,10)}...`);
            return { address };

        } catch (initErr) {
            trace(`TRACE_FAULT: INIT_FAILED -> ${initErr.message}`);
            throw new Error(`INIT_CRASH: ${initErr.message}`);
        }
    }
}
