// wallet-gen.js - Iteration 8.7 (Static Random Handshake)
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
                // Static generator: bypasses the Mnemonic.fromEntropy error
                // 256 bits = 24 words
                mnemonic = Mnemonic.random(256); 
                
                localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
                alert("!! CORE_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + mnemonic.phrase);
            } catch (err) {
                // Final fallback if the random method itself is restricted
                throw new Error("IDENTITY_FORGE_FAILURE: " + err.message);
            }
        } else {
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
