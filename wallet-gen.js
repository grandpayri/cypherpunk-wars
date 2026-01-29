// wallet-gen.js - Iteration 9.2 (Diagnostic Anchor)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity() {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        let phrase = "";

        // 1. RAW QUERY & LOGGING: Check storage before the engine is even called
        try {
            const rawStored = localStorage.getItem('cpw_mnemonic');
            
            if (!rawStored || typeof rawStored !== 'string') {
                console.warn("DIAGNOSTIC: Storage empty or null. Signaling fresh forge.");
                phrase = "SIGNAL_FORGE_NEW"; 
            } else {
                phrase = rawStored;
                console.log("DIAGNOSTIC: Found stored phrase string.");
            }
        } catch (e) {
            // If even reading localStorage fails, we flag it
            console.error("DIAGNOSTIC: LocalStorage access blocked.");
            phrase = "SIGNAL_BLOCK_ERROR";
        }

        // 2. THE HANDSHAKE CATCH BLOCK
        try {
            if (phrase === "SIGNAL_FORGE_NEW" || phrase === "SIGNAL_BLOCK_ERROR") {
                // Generate fresh using the library's internal randomizer
                const temp = Mnemonic.random(256);
                phrase = temp.phrase;
                localStorage.setItem('cpw_mnemonic', phrase);
                alert("!! OPERATOR_IDENTITY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + phrase);
            }

            // Explicitly force string type to prevent arg.charCodeAt error
            const cleanPhrase = String(phrase).trim();
            const mnemonic = new Mnemonic(cleanPhrase);

            const seed = await mnemonic.toSeed();
            const xpriv = ExtendedPrivateKey.fromSeed(seed);
            
            const privateKey = xpriv.deriveChild(44, true)
                                    .deriveChild(111111, true)
                                    .deriveChild(0, true)
                                    .deriveChild(0)
                                    .deriveChild(0).privateKey;

            const address = privateKey.toAddress(this.network).toString();
            localStorage.setItem('cpw_addr', address);

            return { address };

        } catch (err) {
            // Return the specific "Known Value" to the game log
            console.error("HANDSHAKE_CRASH:", err.message);
            
            // This return value will show up as the error message in index.html
            throw new Error(`DIAGNOSTIC_CATCH: [${phrase.substring(0,10)}...] -> ${err.message}`);
        }
    }
}
