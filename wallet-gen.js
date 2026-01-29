// wallet-gen.js - BIP39 Identity Utility (Iteration 8.0)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity() {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        // Critical: Explicitly check for Mnemonic availability before execution
        if (!Mnemonic) throw new Error("WASM_MNEMONIC_BINDING_LOST");

        let mnemonic;
        let savedMnemonic = localStorage.getItem('cpw_mnemonic');
        
        if (!savedMnemonic) {
            // Pattern fix: Explicit entropy generation for 24 words
            try {
                // Use the static constructor pattern found in Kasia
                mnemonic = Mnemonic.random(256); 
                localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
                alert("!! CORE_KEY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + mnemonic.phrase);
            } catch (randomErr) {
                throw new Error("CRYPTO_SUBSYSTEM_UNAVAILABLE: " + randomErr.message);
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
