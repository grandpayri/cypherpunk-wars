// wallet-gen.js - Iteration 8.8 (Universal Fallback Handshake)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity() {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        if (!Mnemonic) throw new Error("WASM_MNEMONIC_CLASS_NOT_FOUND");

        let mnemonic;
        let savedMnemonic = localStorage.getItem('cpw_mnemonic');
        
        if (!savedMnemonic) {
            try {
                // UNIVERSAL PATTERN: Try the most basic constructor first.
                // In many WASM builds, calling 'new Mnemonic()' with no arguments 
                // generates a fresh 24-word phrase automatically.
                mnemonic = new Mnemonic(); 
                
                if (!mnemonic.phrase) {
                     // If that returned an empty object, try the random generator
                     mnemonic = Mnemonic.random(256); 
                }

                localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + mnemonic.phrase);
            } catch (err) {
                // Final desperation: The library is rejecting all internal generation.
                throw new Error("IDENTITY_FORGE_FAILURE: " + err.message);
            }
        } else {
            // Restore from saved string
            mnemonic = new Mnemonic(savedMnemonic);
        }

        const seed = await mnemonic.toSeed();
        const xpriv = ExtendedPrivateKey.fromSeed(seed);
        
        // Standard Kaspa derivation path m/44'/111111'/0'/0/0
        const privateKey = xpriv.deriveChild(44, true)
                                .deriveChild(111111, true)
                                .deriveChild(0, true)
                                .deriveChild(0)
                                .deriveChild(0).privateKey;

        const address = privateKey.toAddress(this.network).toString();
        localStorage.setItem('cpw_addr', address);

        return { privateKey, address };
    }
}
