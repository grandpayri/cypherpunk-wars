// wallet-gen.js - BIP39 Identity & Key Derivation Utility
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity() {
        // Accessing the classes from the instance passed from index.html
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        if (!Mnemonic || !ExtendedPrivateKey) {
            throw new Error("KASPA_WASM_CLASSES_NOT_LOADED");
        }

        let mnemonic;
        let savedMnemonic = localStorage.getItem('cpw_mnemonic');
        
        if (!savedMnemonic) {
            mnemonic = Mnemonic.random(256); 
            localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
        } else {
            mnemonic = new Mnemonic(savedMnemonic);
        }

        const seed = await mnemonic.toSeed();
        const xpriv = ExtendedPrivateKey.fromSeed(seed);
        
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
