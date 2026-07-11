# ZK Spike: Provable Gameplay Formulas

**Status: experimental, not wired into the shipped game, but the on-chain path is now
confirmed working.** Nothing in this folder is loaded by `index.html`/`bunker.html`/etc.
— it's a standalone research spike. But unlike the first pass, this now includes a real,
accepted, on-chain transaction: a snarkjs-generated Groth16 proof, converted to Arkworks
encoding, verified live on testnet-10 by Kaspa's native `OpZkPrecompile` opcode.

**Confirmed on-chain (2026-07-11):** three real transactions, not just a synthetic test:

1. Bare ZK verify: [`e03c770cfa594151265d664b1ff524fa6fdc4e20f7ea2a915be41bea7d159901`](https://tn10.kaspa.stream/transactions/e03c770cfa594151265d664b1ff524fa6fdc4e20f7ea2a915be41bea7d159901)
   — status `Accepted`, mass `161,094`, a P2SH covenant whose redeem script is just
   `push(vk) → push(tag=0x20) → OpZkPrecompile`. No signature, no payload, no payout —
   isolates the ZK opcode's own cost.
2. **The realistic shape**: [`c8bc19f0757143cd8cc105b63c8e0a434b78981baa29c54c4004dd9dcf268d81`](https://tn10.kaspa.stream/transactions/c8bc19f0757143cd8cc105b63c8e0a434b78981baa29c54c4004dd9dcf268d81)
   — status `Confirmed`, mass `176,736`, fee `0.3 KAS`. Same covenant plus a real player
   signature (`OpCheckSigVerify`), the actual 0.2 KAS prize-pool payout
   (`PRIZE_VAULT_ADDRESS`/`PHISH_REWARD_AMOUNT_SOMPI` from `../kaspa-client.js`), and a
   real 47-byte CPW1 payload (decodes on-chain as `4350573102...` = `"CPW1"` + `PHISH` tag
   + the 42-byte game-state snapshot). This is what a real ZK-verified Phish turn actually
   costs: **signature + payload + output-shape enforcement only added ~15,600 mass** on top
   of the bare verify — the ZK opcode itself dominates the cost, everything else is cheap.
   **Real floor: ~0.377 KAS/turn** (0.2 KAS reward + ~0.177 KAS fee at the ~100 sompi/gram
   network floor), vs. ~0.205 KAS for the current non-ZK Phish turn — roughly **1.8-2.4x**,
   not the order-of-magnitude blowup early (buggy) measurements suggested.

3. **The real formula, on-chain**: [`afd5bbcb09bac39d986fb518551bff6fc51178a93104f38f926c298551c30ddd`](https://tn10.kaspa.stream/transactions/afd5bbcb09bac39d986fb518551bff6fc51178a93104f38f926c298551c30ddd)
   — status `Confirmed`, mass `186,866`, fee `0.3 KAS`. Same realistic shape as #2, but
   the ZK proof is for the actual `baseRoll + sectorBonus + specBonus` formula (design-bible.md
   06), not the `seed+10` stand-in — proving `seed=17, sectors=5, nodeSpec=Infrastructure ->
   yieldAmount=52` (`27` base roll + `10` sector bonus + `15` Infrastructure bonus). The VK
   grew from 328 to 392 bytes (2 more public inputs: `sectors`, `nodeSpec`), and mass grew by
   only `10,130` over transaction #2 despite that — confirms the third-party demo's claim
   that Groth16 verification cost stays roughly constant regardless of circuit complexity.
   The on-chain payload decodes to `punkw=52, sectors=5, nodeSpec=2, turnCount=1`, matching
   the proof's public inputs exactly. Built via `onchain-test-real-formula.html`, first-try
   success — every lesson from transactions #1-2's debugging (the six items below) held.

Transactions #1 and #2 above used the OLD stand-in circuit (`yieldAmount = seed + 10`, no
sectors/nodeSpec) and predate the real formula — kept as historical record of the
debugging process (see "What it took," below), not as the current state.

4. **The branched covenant + live in-browser proof generation, fully wired into `../kaspa-
   client.js`/`../zk-prover.js`** (the actual code the shipped game now calls, not a
   spike-only script): [`aa97ed54cc1f25346851f86ab7fcf71593011943f73e86babe702ca35941a8b4`](https://tn10.kaspa.stream/transactions/aa97ed54cc1f25346851f86ab7fcf71593011943f73e86babe702ca35941a8b4)
   — the real-claim half of a full anchor → poll → prove → claim cycle (disposable identity,
   faucet-funded straight into the ZK-Phish covenant, anchor tx, accepting-block-hash poll,
   live Groth16 proof generated in-browser in 0.81s, real claim tx with the `OpIf`/`OpElse`
   branched redeem script), completed end-to-end in 10.2s via `onchain-test-live-proof.html`.
   Confirms the branched-covenant design (see design note in `../kaspa-client.js`'s ZK-Phish
   section) is sound on-chain, not just in local script-shape review.

## Incident: stale hardcoded verifying key (found and fixed 2026-07-11)

After transaction #3 above succeeded, wiring the pattern into `../kaspa-client.js` (a
`PHISH_YIELD_VERIFICATION_KEY_HEX` constant baked into the branched redeem script)
started failing on-chain with `"ZK Integrity: Groth16 verification failed"` — despite the
exact same proof passing both `snarkjs.groth16.verify()` and `kaspa-zk-convert`'s own
independent `ark-groth16` re-verification locally, every time.

Root cause, found by fetching transaction #3's own signature script back off the chain
(`api-tn10.kaspa.org/transactions/<txid>`) and diffing its real, on-chain-accepted VK bytes
against the hardcoded constant byte-for-byte: **they diverged starting at byte 160 of 392.**
The two values shared an identical tail (the γ/δ/IC portion of the VK) but differed in the
head (the α/β portion) — the signature of `build-prod/phishYield_production.zkey` having
been *regenerated* at some point after transaction #3 was broadcast (Groth16's circuit-
specific setup step samples fresh α/β randomness on every run, and `zkey contribute`
re-randomizes δ on every run too — neither step is deterministic across re-runs, even
with byte-identical inputs). Once the zkey was regenerated for any reason during later
debugging, the OLD hardcoded VK silently stopped matching the NEW zkey the browser was
actually proving against — while still passing every *local* check, since local
verification only confirms "this proof matches its own accompanying vk," never "is this
the vk actually pinned in the redeem script."

**Local verification alone is not sufficient evidence a hardcoded on-chain constant is
still correct after any zkey regeneration.** The fix: regenerate
`PHISH_YIELD_VERIFICATION_KEY_HEX` fresh from the *current* `zk/phishYield.zkey` via
`kaspa-zk-convert`, confirmed via a rebuilt `onchain-test-production-vk-isolated.html` run
(txid `116d0bff993fbe66cbb995329e2515cc331a0c0b5178f0017ff5d8c4b823c45a`) before trusting it
in the real branched covenant. See the `IMPORTANT` comment directly above the constant in
`../kaspa-client.js` for the same warning at the point of highest future risk.

## Why this exists

Every CPW1 payload is self-reported: a player's own client computes a result (e.g. Phish
yield) and just writes it into the transaction. Nothing stops a patched client from
claiming a bogus number. Kaspa's Toccata hard fork added `OpZkPrecompile` (opcode `0xa6`,
KIP-16) — a native Groth16 verifier a covenant script can call — so in principle a
covenant could require "this output is only valid if it comes with a zk-proof that it was
computed correctly," without the chain re-running the game logic itself. This spike proves
that mechanism actually works, end to end, before wiring it into real gameplay.

## Layout

- `circuits/phishYield.circom` — the circuit (see below).
- `scripts/setup.js` / `scripts/prove.js` — circom + snarkjs pipeline (compile, local
  trusted setup, witness, proof, local verify). Node/JS, no chain involvement.
- `kaspa-zk-convert/` — a small Rust binary that converts a snarkjs proof/verifying-key/
  public-signals triple into the exact Arkworks-compressed byte encoding rusty-kaspa's
  `OpZkPrecompile` verifier expects (pinned to `ark-bn254`/`ark-groth16`/`ark-serialize`
  `0.6.0`, matching rusty-kaspa's own dependency versions exactly). Re-verifies the parsed
  proof with `ark-groth16`'s own `verify_proof` before trusting any output bytes — see
  "Two independent verifications" below.
- `onchain-test.html` — the bare ZK-verify test (transaction 1 above, OLD stand-in circuit):
  faucet-funds a disposable identity, derives the ZK-only P2SH covenant, submits the spend.
- `onchain-test-phish.html` — the realistic shape (transaction 2 above, OLD stand-in
  circuit): same ZK verify, plus `OpCheckSigVerify` against the player's own pubkey, the
  real 0.2 KAS prize-pool payout matching `../kaspa-client.js`'s actual constants, and a
  real CPW1 payload.
- `onchain-test-real-formula.html` — the same realistic shape, but proving the REAL Phish
  yield formula (transaction 3 above) instead of the stand-in — this is the current/live
  version, first-try success once the lessons from the other two pages were already
  learned. All three pages need a real HTTP origin (`kaspa.js` fetches its WASM via
  `import.meta.url`, which needs `http://`, not `file://`) — open via a static server, e.g.
  `.claude/launch.json`'s `static-site` config.

## The circuit: `circuits/phishYield.circom`

**Now implements the real formula, not a stand-in** (decided 2026-07-11 — see
`design-bible.md` section 06 for the full design rationale). `bunker.html`'s current
placeholder (`Math.floor(Math.random() * 40) + 10`, `bunker.html:108`) is pure randomness —
there's nothing to prove about a random number, any output is "correct" by definition. The
real formula replaces that with a **deterministic commit-reveal** scheme:

```
baseRoll    = 10 + seed                    (seed in [0, 39] -> [10, 49], same range as today)
sectorBonus = sectors * 2
specBonus   = (nodeSpec == INFRASTRUCTURE) ? 15 : 0
yieldAmount = baseRoll + sectorBonus + specBonus
```

1. Before the outcome matters, the player commits to a private `seed` by publishing
   `commitment = Poseidon(seed)`.
2. To claim a yield, the player proves — without revealing `seed` — that:
   - `commitment` really is `Poseidon(seed)` (can't swap in a different seed after the fact),
   - `seed` is in `[0, 39]` (matches `Math.floor(Math.random()*40)`'s real range exactly —
     an earlier draft of this circuit used `[0, 30]` as a placeholder range before the real
     formula was decided; that mismatch is now fixed),
   - `sectors` is in `[0, 200)` and `nodeSpec` is a valid enum value `0-5` (sanity bounds
     for the constraint system, not game-design caps),
   - `yieldAmount` is exactly the sum above — ties the public output to the committed seed
     *and* the declared sectors/nodeSpec, not an arbitrary self-reported number.

With `sectors=0`/`nodeSpec=UNSET` (today's actual on-chain state for every player, since
neither mechanic is built yet), this reduces to `yieldAmount = baseRoll` — confirmed via
`node scripts/prove.js 5 0 0` → `yieldAmount = 15` (just the base roll, no bonuses).
`node scripts/prove.js 17 5 2` → `yieldAmount = 52` (`27` base + `10` sector bonus + `15`
Infrastructure bonus) confirms the bonuses apply correctly. 464 constraints total — still
trivially small, compiles and proves in under a second. This exact case (seed=17, sectors=5,
nodeSpec=Infrastructure) is also confirmed on-chain — transaction 3 at the top of this file.

**What this doesn't solve:** the circuit proves yield follows correctly *from* whatever
`sectors`/`nodeSpec` values the proof declares — not that those values are the operator's
true, current on-chain state. Checking that is a separate state-continuity problem (see
design-bible.md 06's closing note) that needs its own design pass before this becomes a
real covenant, not just a circuit.

This establishes the **pattern** to replicate per gameplay function (Research tier
unlocks, Attack/combat resolution, Armageddon casts, etc.) once each of those has its own
well-defined formula — each will need its own circuit and its own design pass.

## Reproducing the local round-trip

### Getting circom

No circom binary is checked in (12 MB platform-specific executable). Download the release
binary for your platform:

```
gh release download v2.2.3 --repo iden3/circom --pattern "circom-windows-amd64.exe" --dir bin --clobber
mv bin/circom-windows-amd64.exe bin/circom.exe
```

(swap the pattern for `circom-linux-amd64` / `circom-macos-amd64` on other platforms, and
drop the `.exe` rename). `bin/` is gitignored.

### Install + run

```
npm install
node scripts/setup.js          # compile circuit, run local trusted setup -> build/
node scripts/prove.js 17 5 2   # commit seed=17, sectors=5, nodeSpec=Infrastructure -> prove, verify, confirm tamper-rejection
```

Confirmed output for `seed=17, sectors=5, nodeSpec=2`: `yieldAmount = 52` (`27` base roll +
`10` sector bonus + `15` Infrastructure bonus), `snarkjs.groth16.verify()` returns `OK!`,
and a tampered public signal is correctly rejected — the proof is bound to the exact
claimed value, not a rubber stamp. `node scripts/prove.js 5 0 0` confirms the
no-bonuses-yet baseline: `yieldAmount = 15`, exactly the base roll alone.

`build/` (r1cs, wasm, ptau, zkey, witness, proof) is gitignored and fully regenerated by
`scripts/setup.js` + `scripts/prove.js` — nothing about this circuit depends on files that
aren't checked in.

## Two independent verifications, not one

A proof that only passes `snarkjs.groth16.verify()` isn't enough evidence it'll pass
on-chain — snarkjs's own proof/verifying-key serialization is not the same byte format
Kaspa's Arkworks-based verifier deserializes. `kaspa-zk-convert` closes that gap by
re-parsing the same proof with `ark-groth16` (the *same crate* rusty-kaspa's verifier uses,
version-pinned to match) and calling its own `verify_proof` independently, before trusting
any converted bytes. Both verifications passing — snarkjs's own, and a from-scratch
Arkworks reconstruction — is what made it safe to trust the encoding before spending
testnet cycles on a live broadcast.

Reproducing the conversion:

```
cd kaspa-zk-convert
cargo run --release   # requires Rust; reads ../build/{proof,verification_key,public}.json
```

Prints `swap_g2=false: ark-groth16 verify_proof = true` (confirming snarkjs's G2 point
coordinate order needs no swap to match Arkworks — this isn't guaranteed for every
toolchain pairing and was verified empirically, not assumed) and writes
`../build/onchain_encoding.json` with the hex-encoded proof, verifying key, and public
inputs ready to push onto a Kaspa script stack.

## What it took to get from "converts cleanly" to "accepted on-chain"

Every one of these was a real rejection from the network, not a guess:

1. **Split the redeem script from the signature script.** Baking proof + verifying key +
   public inputs all into one P2SH redeem script blew past Kaspa's 520-byte single-push
   limit (531 bytes). Fix, which also happens to be the architecturally correct shape: only
   the **verifying key** belongs in the fixed redeem script (it defines which circuit this
   covenant enforces); the **proof and public inputs** are per-claim data pushed via the
   signature script at spend time, landing on the stack below the redeem script's own
   `push(vk) → push(tag) → OpZkPrecompile` when it executes.
2. **`computeBudget` is a `u16`, denominated in coarse units, not raw script units.**
   `TransactionInput.computeBudget` (rusty-kaspa's `compute_commit` field, `ComputeBudget`
   variant) is measured in units of `SCRIPT_UNITS_PER_COMPUTE_BUDGET_UNIT` = 10,000 raw
   script units each (`GRAMS_PER_COMPUTE_BUDGET_UNIT(100) * SCRIPT_UNITS_PER_GRAM(100)`,
   `consensus/core/src/mass/units.rs`), and transaction compute mass includes
   `100 grams * computeBudget` as one term (`consensus/core/src/mass/mod.rs`,
   `calc_non_contextual_masses`). Setting it to a raw script-unit count (e.g. 16,000,000)
   silently overflows the u16 and wraps (mod 65,536) to a small, wrong value — which
   produces a *plausible-looking but wrong* mass figure, not an obvious error. The real
   value needed is `ceil(script_units_used / 10,000)` — around 1,550-1,600 for this
   circuit's ~15.5M script-unit cost.
3. **`computeBudget` requires transaction `version >= 1`**, and `sigOpCount` (the
   default/legacy field `createTransaction()` always populates) must be explicitly cleared
   first — leaving both set is rejected as "inconsistent with transaction version".
4. **Spend from exactly one UTXO.** Repeated failed attempts left unspent funding UTXOs
   sitting at the same deterministic P2SH covenant address (a rejected transaction never
   spends its inputs). Passing *all* of them into one transaction, then setting
   `computeBudget` on every resulting input via a blanket loop, multiplied the committed
   compute budget across inputs that didn't need it at all — inflating mass by ~6x in one
   observed case. Select a single sufficient UTXO as the sole input instead.

None of this was guessable from documentation — each was found by reading rusty-kaspa's
actual source (`crypto/txscript/src/`, `consensus/core/src/mass/`) after a real rejection,
and by cross-checking against [a live third-party Groth16 demo](https://kaspa-app.vercel.app/zk)
which published real measured costs (15,500,893 script units → ~294k compute mass) that
didn't match this session's early, much larger, wrong numbers — the mismatch is what
revealed the `u16`/unit bug.

Getting from the bare verify to the realistic signature+ZK+payload shape
(`onchain-test-phish.html`) surfaced three more, all in `createInputSignature()`'s exact
output format when signing a raw `createTransaction()`-built transaction (a path this
codebase's own comments already flagged as untested — `signRestrictedWalletSpend` in
`../kaspa-client.js` uses `PendingTransaction`'s method instead, which handles all three
of these internally):

5. **The faucet vault's redeem script must be reconstructed byte-for-byte, not
   approximately.** Hardcoding the cap check as `10000000000n` (100 KAS) instead of the
   real deployed `FAUCET_GRANT_CAP_SOMPI = 1000000000n` (10 KAS) made the locally-built
   script hash to a different value than what `FAUCET_VAULT_ADDRESS` actually committed to
   — surfacing as "false stack entry at end of script execution" (P2SH's hash check is
   itself a script-level comparison) rather than an obvious "wrong script" error. Import
   the real constant; don't retype it.
6. **`createInputSignature()`'s hash-type byte is a raw protocol value, not the JS SDK's
   enum index.** `SighashType.All` is `0` in the JS API, but the actual wire-format byte
   `OpCheckSig` expects appended to the signature is `0x01` (`SIG_HASH_ALL = 0b00000001`,
   `consensus/core/src/hashing/sighash_type.rs`) — appending `0x00` gets "invalid hash type
   0x00".
7. **`createInputSignature()` already returns a length-prefixed blob, not a bare
   signature.** The return value is 66 bytes: a leading `0x41` (=65 decimal) self-describing
   push-length byte, then the real 65-byte payload (64-byte Schnorr signature + the
   hash-type byte from #6, already appended). `ScriptBuilder.addData()` adds its own
   correct push-length prefix, so passing the raw 66-byte value double-prefixes it. Two
   wrong attempts (bare 66 bytes, and 66+1=67 bytes after manually appending the hash-type
   byte believing it was still missing) both failed as "malformed signature" before
   `rawSigHex.slice(2)` — stripping just the leading length byte — worked.

## Important caveats before this goes any further

- **The Powers of Tau here is self-generated, single-contributor, local-only.** Fine for a
  spike; **not** a public ceremony. Before any circuit built with this pattern is used for
  anything that touches real funds or a live covenant, swap in a publicly-audited ceremony
  (e.g. the Hermez `powersOfTau28_hez_final` series) — reusing a self-generated ptau in
  production means whoever ran the setup (i.e. this session) technically knows the toxic
  waste and could theoretically forge proofs.
- **This is a stand-in formula, not the final Phish yield design.** The real economy
  formula (referenced in the main roadmap's Phase 6) hasn't been decided yet. Don't treat
  `seed + 10` as anything other than "smallest thing that let us test the toolchain."
- **One proof per transaction is a hard ceiling.** At ~294-380k compute mass per Groth16
  verify against the 500k/tx limit, two verifications don't fit in one transaction. Any
  future covenant design (e.g. resolving multiple simultaneous claims) must budget exactly
  one verify per transaction.
- **Real per-turn cost, confirmed:** the realistic shape with the actual formula
  (signature + ZK verify + prize payout + payload, `onchain-test-real-formula.html`, tx 3)
  costs `186,866` mass, ~`0.387` KAS at the network's real fee floor — vs. `0.205` KAS for
  the current non-ZK Phish turn. Roughly **1.9x** the current cost, not an order of
  magnitude. Still ~313k mass of headroom under the 500k/tx ceiling if a future covenant
  needs more logic (e.g. Attack/combat resolution, which will likely need its own circuit
  and its own mass budget check).
- Any live experimentation that touches testnet-10 should use a disposable throwaway
  keypair (`forgeNewIdentity()` / `requestFaucetGrant()`), never real credentials — same
  rule as the rest of this repo's covenant work. All three on-chain test pages follow this
  already.
