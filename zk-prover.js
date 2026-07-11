/**
 * CYPHERPUNK_WARS: ZK_PROVER
 * zk-prover.js
 *
 * Generates a real Groth16 proof of the Phish yield formula (design-bible.md section 06)
 * entirely in the player's browser -- no backend, matching this repo's static-hosting
 * constraint. Built and proven against real on-chain transactions in zk-spike/ before
 * this file existed; see zk-spike/README.md for the full discovery/incident log.
 *
 * Static assets this depends on (vendored under ./zk/, same pattern as kaspa.js/
 * kaspa_bg.wasm): phishYield.wasm (circuit witness calculator), phishYield.zkey
 * (production proving key, public Hermez trusted setup -- see zk-spike/README.md),
 * verification_key.json, snarkjs.esm.js (snarkjs's official browser bundle),
 * poseidon.esm.js (circomlibjs's buildPoseidon, bundled via esbuild since it imports the
 * bare specifier "ffjavascript" which the browser can't resolve on its own), and
 * kaspa_zk_convert.js/.wasm (this repo's own Rust-to-WASM proof-to-Arkworks-bytes
 * converter, cross-checked against ark-groth16::verify_proof before ever being trusted --
 * see zk-spike/kaspa-zk-convert/src/lib.rs).
 */
import { groth16 } from './zk/snarkjs.esm.js';
import { buildPoseidon } from './zk/poseidon.esm.js';
import initKaspaZkConvert, { convert as convertToKaspaBytes } from './zk/kaspa_zk_convert.js';

// Resolved against THIS module's own URL (import.meta.url), not the page that happens to
// import it -- a plain relative string like './zk/phishYield.wasm' would resolve against
// the *document's* URL when handed to fetch() (snarkjs's own asset loader does this
// internally), which silently breaks for any page that isn't sitting at the repo root
// right next to zk/ (e.g. zk-spike/'s own test pages one directory down) -- confirmed the
// hard way: a 404 against this static server's minimal handler returns a zero-byte body,
// which surfaces as "WebAssembly.compile(): BufferSource argument is empty" with no
// indication it was ever a 404.
const ZK_ASSET_BASE = new URL('./zk/', import.meta.url);
const CIRCUIT_WASM_URL = new URL('phishYield.wasm', ZK_ASSET_BASE).href;
const CIRCUIT_ZKEY_URL = new URL('phishYield.zkey', ZK_ASSET_BASE).href;
const VERIFICATION_KEY_URL = new URL('verification_key.json', ZK_ASSET_BASE).href;
const KASPA_ZK_CONVERT_WASM_URL = new URL('kaspa_zk_convert_bg.wasm', ZK_ASSET_BASE).href;

// design-bible.md section 06.
export const NODE_SPEC_INFRASTRUCTURE = 2;

let poseidonPromise = null;
function getPoseidon() {
    if (!poseidonPromise) poseidonPromise = buildPoseidon();
    return poseidonPromise;
}

let kaspaZkConvertReady = false;
let kaspaZkConvertInitPromise = null;
async function ensureKaspaZkConvertReady() {
    if (kaspaZkConvertReady) return;
    if (!kaspaZkConvertInitPromise) kaspaZkConvertInitPromise = initKaspaZkConvert(KASPA_ZK_CONVERT_WASM_URL);
    await kaspaZkConvertInitPromise;
    kaspaZkConvertReady = true;
}

let verificationKeyJsonPromise = null;
function getVerificationKeyJson() {
    if (!verificationKeyJsonPromise) {
        verificationKeyJsonPromise = fetch(VERIFICATION_KEY_URL).then((r) => {
            if (!r.ok) throw new Error(`VERIFICATION_KEY_FETCH_FAILED: ${r.status}`);
            return r.text();
        });
    }
    return verificationKeyJsonPromise;
}

function bytesToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Derives the circuit's `seed` input from a local secret plus the anchor transaction's
// accepting-block hash (unpredictable to the player at anchor-broadcast time -- see
// kaspa-client.js's ZK-Phish covenant section comment for exactly what this does and
// doesn't guarantee). Plain SHA-256, not Poseidon -- this step never runs inside the
// circuit, so it doesn't need to be circuit-friendly; only the resulting seed value and
// its Poseidon commitment are ever seen by the proof.
export async function deriveSeedFromAnchor(localSecretHex, acceptingBlockHash) {
    const data = new TextEncoder().encode(`${localSecretHex}:${acceptingBlockHash}`);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const view = new DataView(hashBuf);
    return view.getUint32(0, false) % 40; // matches the circuit's seed range check, [0, 39]
}

export function generateLocalSecretHex() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
}

// Generates a real Groth16 proof for the Phish yield formula and converts it to the exact
// byte encoding the on-chain covenant expects. Returns
// { yieldAmount, proofBundle: { proofHex, publicInputHexes } } -- proofBundle is what
// kaspa-client.js's spendZkVerifiedPhish()/buildZkPhishClaimSigScript() take directly.
export async function generatePhishYieldProof({ seed, sectors, nodeSpec }) {
    if (seed < 0 || seed > 39) throw new Error(`SEED_OUT_OF_RANGE: ${seed}`);

    const poseidon = await getPoseidon();
    const commitment = poseidon.F.toObject(poseidon([BigInt(seed)])).toString();

    const input = {
        seed: String(seed),
        commitment,
        sectors: String(sectors),
        nodeSpec: String(nodeSpec),
    };

    const { proof, publicSignals } = await groth16.fullProve(input, CIRCUIT_WASM_URL, CIRCUIT_ZKEY_URL);

    // Sanity-check locally before ever converting/broadcasting -- a proof that doesn't
    // verify against its own declared public signals is never worth spending a real
    // transaction on.
    const vkJson = await getVerificationKeyJson();
    const localOk = await groth16.verify(JSON.parse(vkJson), publicSignals, proof);
    if (!localOk) throw new Error('LOCAL_PROOF_VERIFICATION_FAILED');

    await ensureKaspaZkConvertReady();
    const resultJson = convertToKaspaBytes(JSON.stringify(proof), vkJson, JSON.stringify(publicSignals));
    const result = JSON.parse(resultJson);

    // publicSignals[0] is always the circuit's sole output (yieldAmount) -- circom
    // convention, outputs first then declared public inputs (commitment, sectors,
    // nodeSpec), matching the order confirmed throughout zk-spike's on-chain testing.
    const yieldAmount = Number(publicSignals[0]);

    return {
        yieldAmount,
        proofBundle: {
            proofHex: result.proof_hex,
            publicInputHexes: result.public_input_hexes,
        },
    };
}
