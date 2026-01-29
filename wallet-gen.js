// wallet-gen.js - Iteration 9.1 (Self-Healing Storage)
export class WalletGen {
    constructor(kaspaInstance, network = "mainnet") {
        this.kaspa = kaspaInstance;
        this.network = network;
    }

    async initIdentity() {
        const { Mnemonic, ExtendedPrivateKey } = this.kaspa;
        let mnemonic;
        let phrase = localStorage.getItem('cpw_mnemonic');

        // 1. PRE-FLIGHT CHECK: Catch empty or invalid storage
        if (!phrase || typeof phrase !== 'string' || phrase.length < 10) {
            console.warn("IDENTITY_EMPTY: Initializing fresh state.");
            phrase = "NEW_IDENTITY_REQUIRED"; // Known value for logic check
        }

        try {
            if (phrase === "NEW_IDENTITY_REQUIRED") {
                // 2. FORGE: Generate a new 24-word string
                const temp = Mnemonic.random(256);
                phrase = temp.phrase;
                
                if (!phrase) throw new Error("WASM_RETURNED_NULL_PHRASE");
                
                localStorage.setItem('cpw_mnemonic', phrase);
                alert("!! NEW_OPERATOR_KEY_FORGED !!\n\nRECORD THESE 24 WORDS:\n\n" + phrase);
            }

            // 3. INITIALIZE: Try to pass the phrase to the engine
            mnemonic = new Mnemonic(phrase);

        } catch (err) {
            // 4. RECOVERY: If initialization still fails, it's corrupted
            console.error("STORAGE_CRASH: Resetting cpw_mnemonic due to error:", err.message);
            localStorage.removeItem('cpw_mnemonic');
            
            // Return a "Known Value" error message to the operator log
            throw new Error(`RECOVERY_REQUIRED: Invalid phrase format detected. (${err.message})`);
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
