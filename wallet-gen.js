// wallet-gen.js - BIP39 Identity Utility
//7.05
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity() {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        
        if (!Mnemonic) throw new Error("WASM_MNEMONIC_CLASS_MISSING");

        let mnemonic;
        let savedMnemonic = localStorage.getItem('cpw_mnemonic');
        
        if (!savedMnemonic) {
            mnemonic = Mnemonic.random(256); // 24 words
            localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
            alert("NEW_OPERATOR_KEY_GENERATED:\n\n" + mnemonic.phrase);
        } else {
            mnemonic = new Mnemonic(savedMnemonic);
        }

        const seed = await mnemonic.toSeed();
        const xpriv = ExtendedPrivateKey.fromSeed(seed);
        
        // m/44'/111111'/0'/0/0 derivation
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
