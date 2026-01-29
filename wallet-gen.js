// wallet-gen.js - Iteration 8.5 (Direct Constructor Handshake)
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
                // Generate 32 bytes of raw entropy from the browser
                const entropy = new Uint8Array(32);
                window.crypto.getRandomValues(entropy);
                
                // Directly pass entropy to the constructor
                mnemonic = new Mnemonic(entropy);
                
                localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
                alert("!! CORE_KEY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + mnemonic.phrase);
            } catch (err) {
                throw new Error("CRYPTO_HANDSHAKE_FAILED: " + err.message);
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
