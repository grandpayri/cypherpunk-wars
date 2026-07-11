pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// The real Phish yield formula (see design-bible.md section 06, decided
// 2026-07-11), replacing bunker.html's placeholder
// `Math.floor(Math.random() * 40) + 10` (bunker.html:108) and the
// `seed + 10` stand-in this circuit used before that formula existed.
//
//   baseRoll    = 10 + seed                     [10, 49], seed in [0, 39]
//   sectorBonus = sectors * SECTOR_YIELD_BONUS
//   specBonus   = (nodeSpec == INFRASTRUCTURE) ? NODE_SPEC_INFRA_BONUS : 0
//   yieldAmount = baseRoll + sectorBonus + specBonus
//
// Anti-cheat shape unchanged from the original spike: the player commits to
// a private `seed` (Poseidon hash) before the yield is claimed. This proves,
// without revealing `seed`, that:
//   1. `commitment` really is Poseidon(seed) -- the player can't swap in a
//      different seed after the fact.
//   2. `seed` is in [0, 39] -- the same range Math.floor(Math.random()*40)
//      produces, so a valid proof can't claim an inflated base roll.
//   3. `sectors` is in [0, 200) -- a sanity bound to keep the constraint
//      system's range checks well-defined, not a hard game-design cap (see
//      design-bible.md 06).
//   4. `nodeSpec` is a real enum value (0-5, matching NodeSpecialization in
//      kaspa-client.js), and the Infrastructure bonus applies only when it
//      equals INFRASTRUCTURE (2).
//   5. `yieldAmount` is exactly the sum above -- ties the public output to
//      the committed seed and the declared sectors/nodeSpec, not an
//      arbitrary self-reported number.
//
// What this does NOT prove: that `sectors`/`nodeSpec` are the operator's
// true, current on-chain values -- only that yieldAmount follows correctly
// FROM whatever sectors/nodeSpec this proof declares. Checking those
// against the operator's actual previous game-state snapshot is a separate,
// unsolved state-continuity problem (design-bible.md 06's closing note).
template PhishYield() {
    signal input seed;          // private witness
    signal input commitment;    // public
    signal input sectors;       // public
    signal input nodeSpec;      // public
    signal output yieldAmount;  // public

    var SECTOR_YIELD_BONUS = 2;
    var NODE_SPEC_INFRA_BONUS = 15;
    var NODE_SPEC_INFRASTRUCTURE = 2;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== seed;
    hasher.out === commitment;

    component seedRange = LessThan(8);
    seedRange.in[0] <== seed;
    seedRange.in[1] <== 40;
    seedRange.out === 1;

    component sectorsRange = LessThan(16);
    sectorsRange.in[0] <== sectors;
    sectorsRange.in[1] <== 200;
    sectorsRange.out === 1;

    component nodeSpecRange = LessThan(8);
    nodeSpecRange.in[0] <== nodeSpec;
    nodeSpecRange.in[1] <== 6;
    nodeSpecRange.out === 1;

    component isInfra = IsEqual();
    isInfra.in[0] <== nodeSpec;
    isInfra.in[1] <== NODE_SPEC_INFRASTRUCTURE;

    signal baseRoll;
    baseRoll <== 10 + seed;

    signal sectorBonus;
    sectorBonus <== sectors * SECTOR_YIELD_BONUS;

    signal specBonus;
    specBonus <== isInfra.out * NODE_SPEC_INFRA_BONUS;

    yieldAmount <== baseRoll + sectorBonus + specBonus;
}

component main { public [commitment, sectors, nodeSpec] } = PhishYield();
