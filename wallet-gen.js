// wallet-gen.js - BIP39 Identity Utility (Iteration 8.1)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity() {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        if (!Mnemonic) throw new Error("WASM_MNEMONIC_BINDING_LOST");

        let mnemonic;
        let savedMnemonic = localStorage.getItem('cpw_mnemonic');
        
        if (!savedMnemonic) {
            try {
                // MANUAL ENTROPY INJECTION: Generate 32 bytes (256 bits) via JS Crypto API
                const entropy = new Uint8Array(32);
                window.crypto.getRandomValues(entropy);
                
                // Initialize Mnemonic from the manual entropy array
                mnemonic = Mnemonic.fromEntropy(entropy);
                
                localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
                alert("!! CORE_KEY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + mnemonic.phrase);
            } catch (randomErr) {
                throw new Error("JS_CRYPTO_API_FAILURE: " + randomErr.message);
            }
        } else {
            mnemonic = new Mnemonic(savedMnemonic);
        }

        const seed = await mnemonic.toSeed();
        const xpriv = ExtendedPrivateKey.fromSeed(seed);
        
        // m/44'/111111'/0'/0/0
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
