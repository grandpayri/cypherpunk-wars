pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";

// Build Sector: spend $PUNKW to grow Sectors by exactly 1 per transaction
// (see design-bible.md section 09 for the covenant-scalability pattern this
// reuses, and section 07 for the trust-model caveat below).
//
//   newSectors = oldSectors + 1
//   newPunkw   = oldPunkw - COST_PER_SECTOR
//
// Same trust tier as phishYield.circom's handling of cumulative totals:
// oldPunkw/oldSectors are self-reported PUBLIC inputs, not independently
// verified against the operator's true on-chain history -- Kaspa Script's
// introspection opcodes can only read the current transaction's own fields,
// not an ancestor transaction's payload (confirmed against KIP-10's actual
// opcode set), so there is no way for the covenant to check these against
// a genuine previous snapshot. This circuit proves the TRANSITION arithmetic
// is honest GIVEN whatever oldPunkw/oldSectors were declared -- not that
// those declared values are themselves true. See design-bible.md section 07
// ("Trust Model") for the full, honest statement of what this does and
// doesn't guarantee -- unchanged and unsolved by this circuit.
//
// Range-checked: oldPunkw must be >= COST_PER_SECTOR (can't build into
// negative $PUNKW), and both oldPunkw/oldSectors are bounded to keep the
// constraint system's comparators well-defined, not as hard game-design
// caps (same convention as phishYield.circom's sectorsRange).
template BuildSector() {
    signal input oldPunkw;      // public
    signal input oldSectors;    // public
    signal output newPunkw;     // public
    signal output newSectors;   // public

    var COST_PER_SECTOR = 350;

    component punkwRange = LessThan(32);
    punkwRange.in[0] <== oldPunkw;
    punkwRange.in[1] <== 4294967296; // 2^32, sanity bound only
    punkwRange.out === 1;

    component sectorsRange = LessThan(16);
    sectorsRange.in[0] <== oldSectors;
    sectorsRange.in[1] <== 200; // matches phishYield.circom's own sectors bound
    sectorsRange.out === 1;

    component enoughFunds = GreaterEqThan(32);
    enoughFunds.in[0] <== oldPunkw;
    enoughFunds.in[1] <== COST_PER_SECTOR;
    enoughFunds.out === 1;

    newSectors <== oldSectors + 1;
    newPunkw <== oldPunkw - COST_PER_SECTOR;
}

component main { public [oldPunkw, oldSectors] } = BuildSector();
