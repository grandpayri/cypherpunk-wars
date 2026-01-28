// wallet-gen.js - BIP39 Identity & Key Derivation for CPW
import { Mnemonic, ExtendedPrivateKey } from './kaspa.js';

export class WalletGen {
    constructor(network = "mainnet") {
        this.network = network;
    }

    /**
     * Initializes or restores a 24-word persistent identity.
     * Stored in LocalStorage to maintain 'grandpayri.kas' state across sessions.
     */
    async initIdentity() {
        let mnemonic;
        let savedMnemonic = localStorage.getItem('cpw_mnemonic');
        
        if (!savedMnemonic) {
            // Generate high-entropy 24-word phrase
            mnemonic = Mnemonic.random(256); 
            localStorage.setItem('cpw_mnemonic', mnemonic.phrase);
            alert("NEW_OPERATOR_KEY_GENERATED (24 WORDS):\n\n" + mnemonic.phrase);
        } else {
            mnemonic = new Mnemonic(savedMnemonic);
        }

        const seed = await mnemonic.toSeed();
        const xpriv = ExtendedPrivateKey.fromSeed(seed);
        
        // Standard Kaspa Path m/44'/111111'/0'/0/0
        const privateKey = xpriv.deriveChild(44, true)
                                .deriveChild(111111, true)
                                .deriveChild(0, true)
                                .deriveChild(0)
                                .deriveChild(0).privateKey;

        return {
            privateKey,
            address: privateKey.toAddress(this.network).toString()
        };
    }
}
