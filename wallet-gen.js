// wallet-gen.js - BIP39 Identity & Key Derivation Utility
import * as kaspa from './kaspa.js';

export class WalletGen {
    constructor(network = "mainnet") {
        this.network = network;
    }

    async initIdentity() {
        // Use the exports from the kaspa object
        const { Mnemonic, ExtendedPrivateKey } = kaspa;
        
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
