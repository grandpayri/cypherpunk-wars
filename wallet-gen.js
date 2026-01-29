// wallet-gen.js - Iteration 8.1 (Hardened Handshake)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity() {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        if (!Mnemonic) throw new Error("WASM_ENGINE_NOT_READY");

        let mnemonic;
        let savedMnemonic = localStorage.getItem('cpw_mnemonic');
        
        if (!savedMnemonic) {
            try {
                // 1. Generate manual entropy to bypass the WASM 'undefined' bug
                const entropy = new Uint8Array(32);
                window.crypto.getRandomValues(entropy);
                
                // 2. Initialize the 24-word identity from that entropy
                mnemonic = Mnemonic.fromEntropy(entropy);
                
                localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + mnemonic.phrase);
            } catch (err) {
                throw new Error("CRYPTO_HANDSHAKE_FAILED: " + err.message);
            }
        } else {
            mnemonic = new Mnemonic(savedMnemonic);
        }

        const seed = await mnemonic.toSeed();
        const xpriv = ExtendedPrivateKey.fromSeed(seed);
        
        // Derive standard Kaspa address (m/44'/111111'/0'/0/0)
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
