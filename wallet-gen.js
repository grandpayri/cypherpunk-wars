// wallet-gen.js - Iteration 9.3 (Trace-Enabled Handshake)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity(traceCallback) {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        const trace = traceCallback || console.log;
        
        trace("TRACE: AUDITING_STORAGE...");
        let phrase = localStorage.getItem('cpw_mnemonic');

        // 1. FORGE SEQUENCE
        if (!phrase || phrase.length < 10) {
            trace("TRACE: STORAGE_EMPTY. INITIATING_MANUAL_FORGE...");
            try {
                // Generate entropy via Browser API to avoid the WASM 'undefined' bug
                const entropy = new Uint8Array(32);
                window.crypto.getRandomValues(entropy);
                trace("TRACE: BROWSER_ENTROPY_ACQUIRED.");
                
                trace("TRACE: CONSTRUCTING_MNEMONIC_FROM_ENTROPY...");
                // Feeding entropy directly to the constructor is the most stable Kasia-pattern
                const mnemonicObj = new Mnemonic(entropy);
                phrase = mnemonicObj.phrase;

                if (!phrase) throw new Error("WASM_CONSTRUCTOR_FAILED");
                trace("TRACE: PHRASE_GENERATED_SUCCESSFULLY.");
                
                localStorage.setItem('cpw_mnemonic', phrase);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + phrase);
            } catch (forgeErr) {
                trace(`TRACE_FAULT: FORGE_PHASE_CRASHED - ${forgeErr.message}`);
                throw new Error(`FORGE_CRASH: ${forgeErr.message}`);
            }
        } else {
            trace("TRACE: EXISTING_IDENTITY_DETECTED.");
        }

        // 2. INITIALIZATION SEQUENCE
        try {
            trace("TRACE: BINDING_PHRASE_TO_ENGINE...");
            const cleanPhrase = String(phrase).trim();
            const mnemonic = new Mnemonic(cleanPhrase);
            
            trace("TRACE: CONVERTING_TO_SEED...");
            const seed = await mnemonic.toSeed();
            
            trace("TRACE: DERIVING_XPRIV...");
            const xpriv = ExtendedPrivateKey.fromSeed(seed);
            
            trace("TRACE: DERIVING_PATH_M/44'/111111'/0'/0/0...");
            const key = xpriv.deriveChild(44, true)
                             .deriveChild(111111, true)
                             .deriveChild(0, true)
                             .deriveChild(0)
                             .deriveChild(0).privateKey;

            trace("TRACE: CALCULATING_PUBLIC_ADDRESS...");
            const address = key.toAddress(this.network).toString();
            
            localStorage.setItem('cpw_addr', address);
            trace(`TRACE_SUCCESS: IDENTITY_ARMED_FOR_${address.substring(0,10)}...`);

            return { address };
        } catch (initErr) {
            trace(`TRACE_FAULT: INIT_PHASE_CRASHED - ${initErr.message}`);
            // If the saved phrase is what's causing the crash, wipe it for next attempt
            localStorage.removeItem('cpw_mnemonic');
            throw new Error(`INIT_CRASH: ${initErr.message}`);
        }
    }
}
