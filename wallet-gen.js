// wallet-gen.js - Iteration 8.9 (The Kasia-Direct Bridge)
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
                // 1. Force the library to generate a phrase string first
                // Using 256 bits specifically for the 24-word standard
                const tempMnemonic = Mnemonic.random(256);
                const phraseString = tempMnemonic.phrase; 

                // 2. Feed the string back into a new instance to lock it
                mnemonic = new Mnemonic(phraseString);
                
                localStorage.setItem('cpw_mnemonic', phraseString);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + phraseString);
            } catch (err) {
                throw new Error("CRYPTO_BRIDGE_FAILURE: " + err.message);
            }
        } else {
            // Restore from saved string
            mnemonic = new Mnemonic(savedMnemonic);
        }

        const seed = await mnemonic.toSeed();
        const xpriv = ExtendedPrivateKey.fromSeed(seed);
        
        // Standard Kaspa derivation m/44'/111111'/0'/0/0
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
