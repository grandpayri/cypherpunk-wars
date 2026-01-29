// wallet-gen.js - Iteration 8.4 (Kasia-Compatible Handshake)
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
                // Use the static random() but ensure it has a length argument
                // This is the most stable Kasia-pattern for 24 words
                mnemonic = Mnemonic.random(256); 
                
                localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + mnemonic.phrase);
            } catch (err) {
                // If random(256) still fails, we use the fallback string constructor
                console.warn("Mnemonic.random failed, trying fallback constructor...");
                mnemonic = new Mnemonic(); // Default constructor
                
                localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
                alert("!! IDENTITY_RECOVERED_VIA_FALLBACK !!\n\nRECORD THESE WORDS:\n\n" + mnemonic.phrase);
            }
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
