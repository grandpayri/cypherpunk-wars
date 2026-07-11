# Cypherpunk Wars Design Bible

Developer-facing design reference mapping legacy *Archmage*/*The Reincarnation* (TR) mechanics onto
Cypherpunk Wars (CPW) systems. This is the source of truth for Research trees, unit/army composition,
payload (spell) design, item/hardware design, and infrastructure economy as those systems get built
(Phase 6: Research/Sectors economy; Phase 7: Attack/Hack/Armageddon). Not player-facing lore -- see
`gameplay.html`/`architecture.html`/`whitepaper.html` for that. Lives at the repo root (not alongside
the player-facing pages) since it's build/design reference for developers, not in-fiction lore.

## 01. The Five Alignments -> Node Specializations

Legacy players chose a magical alignment. In CPW these become Node Specializations defining a Bunker's
primary operational focus.

| Legacy Alignment | CPW Specialization | Focus |
|---|---|---|
| Ascendant (White) | **Consensus** (White-Hat Validation) | Defensive cryptographic validation; protects the grid and structural integrity |
| Verdant (Green) | **Infrastructure** (Green-Energy Farming) | Automated data-farming loops, server rack expansion |
| Eradication (Red) | **Overclocking** (Red-Hat Destruction) | Brute-force offense: hardware melting, aggressive network penetration |
| Phantasm (Blue) | **Phantom** (Blue-Hat Stealth) | Stealth routing, VPN spoofing, reconnaissance |
| Nether (Black) | **Darknet** (Black-Hat Hijacking) | Hijacking unsecured IoT devices into disposable botnets |

## 02. Unit & Army Mapping

Operators compile autonomous code vectors and hardware instead of summoning creatures.

| Legacy Unit | CPW Unit | Notes |
|---|---|---|
| Knights Templar & Paladins | **White-Hat Proxies** | Heavy Consensus units; dedicated security nodes intercepting inbound exploits |
| Treants & Earth Elementals | **Mainframe Bricks** | Slow, high-HP Infrastructure units; hardened server racks that absorb punishment, scale efficiency via system updates |
| Goblins & Lizardmen | **Scraping Scripts** | Base-level Overclocking units; cheap, high-volume chaff to overwhelm baseline firewalls |
| Zombies, Ghouls, Liches | **Botnets & Sleeper Agents** | Darknet units from spells/items; hijacked smart-devices, zero native compute cost but constant bandwidth upkeep |
| Angels & Archangels | **Autonomous AI Sentinels** | Pinnacle Consensus units; self-correcting defense algorithms protecting the core ledger |

## 03. Spell & Payload Mapping

Spells become cryptographic scripts/payload executions compiled in a local sandbox. (Note: these are
*game-logic* payloads distinct from the `CPW1` on-chain tagging payload format in `kaspa-client.js` --
a spell's effect is resolved by game logic; whether/how each becomes its own on-chain-verifiable action
via covenants is a Phase 7 design question, not decided yet.)

| Legacy Spell | CPW Payload | Effect |
|---|---|---|
| Meteor Storm | **Cascading Hardware Failure** | Persistent heavy-bandwidth malware degrading an opponent's Sector efficiency over time; costs continuous $PUNKW upkeep to sustain (matches legacy's constant mana drain on the caster) |
| Chain Lightning | **Distributed Denial of Service (DDoS)** | Severe damage to one target, weaker bleed-over to secondary infrastructure |
| Platinum Hand of Healing / Regeneration | **Data Scrubbing & Backup Restore** | Restores corrupted operational data from local backups; brings disconnected servers back online |
| Disintegrate | **Zero-Day Exploit** | Instantly wipes a specific enemy daemon; unblockable, highly targeted |
| Letters of the Thieves' Guild | **Phishing Payload** | Siphons $PUNKW directly from an enemy's war chest, or steals high-tier firmware |

## 04. Item & Hardware Mapping

Items become hardware expansions, firmware upgrades, or cryptographic keys installed into a Bunker.

| Legacy Item | CPW Item | Effect |
|---|---|---|
| Coffin | **Pre-Packaged Botnet Drive** | Randomly grants ~2,000 hijacked devices (Zombie-tier), ~1,000 (Ghoul-tier), or 20 (Lich-tier) without manual compiling |
| Potion of Valor | **Overclock Firmware** | +20% offensive output (AP), temporary |
| Bubble Wine | **Thermal Paste Syringe** | +10% offense, +30% effective HP (advanced cooling lets hardware run hotter, take more punishment) |
| Blood Stained Map | **Compromised Routing Ledger** | Cumulative +15% chance to discover rare, decentralized nodes (legacy: Holy Grails) |
| Oil Flasks & Pixie Dust | **Firewall Degradants** | Permanently lowers a target's cryptographic resistance to subsequent inbound attacks |

## 05. Infrastructure & Economy Mapping

The physical kingdom layout maps to the physical data center layout.

| Legacy System | CPW System | Notes |
|---|---|---|
| Workshops & Build Rate | **Compiling Nodes** | Dictates how fast new Sectors can be spun up |
| Guilds & Nodes | **Validator Network** | Generates incoming $PUNKW yield (Kaspa validator setups) |
| Upkeep (Mana/Gold) | **$PUNKW Upkeep** | Failing to maintain upkeep disbands units/payloads, same as legacy TR |

## 06. Phish Yield Formula (Phase 6 -- decided 2026-07-11, live on testnet-10 since 2026-07-11)

The formula resolved: `bunker.html`'s Phish action (`executePhish()`) used to be a placeholder,
`Math.floor(Math.random() * 40) + 10` -- a pure client-side random roll in `[10, 49]`, self-reported and
unverifiable. This section defines the real formula, designed specifically to be **provable** (see
`zk-spike/circuits/phishYield.circom`) -- deterministic given committed inputs, not just "whatever the
client claims." **This is no longer just a design decision -- it's the formula every live Phish action
proves and verifies on-chain**, via a real Groth16 proof checked natively by Kaspa's `OpZkPrecompile`
opcode (`kaspa-client.js`'s ZK-Phish covenant section, `zk-prover.js` for in-browser proof generation).
Grinding-resistance for the committed seed comes from a separate anchor transaction's accepting block
hash (see the design note above `buildZkPhishRedeemScript` in `kaspa-client.js`, and `zk-spike/README.md`
for the full discovery/incident log) -- real, economically-bounded resistance, not cryptographically
airtight, and stated as such in `phish-result.html`'s own verification note.

**Why the old formula couldn't be proven, and what changes.** A ZK proof can only attest that a
*deterministic* computation was carried out correctly; `Math.random()`'s output is correct by definition
(there's nothing to check it against). The fix is a **commit-reveal seed**: the player commits to a private
`seed` (via a Poseidon hash, published as part of an earlier transaction) before the roll's outcome could
possibly be known or influenced, then reveals it -- bound into the formula below -- when claiming the
yield. This preserves genuine unpredictability (nobody, including the player, can bias the roll after
committing) while making the result checkable.

**The formula:**

```
baseRoll   = 10 + (seed mod 40)                       // [10, 49], same range as the old placeholder
sectorBonus = sectors * SECTOR_YIELD_BONUS             // SECTOR_YIELD_BONUS = 2
specBonus   = (nodeSpec == INFRASTRUCTURE) ? NODE_SPEC_INFRA_BONUS : 0   // NODE_SPEC_INFRA_BONUS = 15
yieldAmount = baseRoll + sectorBonus + specBonus
```

**Why these specific terms, not others:**

- **`baseRoll` keeps the existing [10, 49] range.** No reason to re-balance the core roll while nothing
  else about early-game pacing has changed -- this is a drop-in replacement for the placeholder, not a
  rebalance. (An earlier draft of the ZK circuit, built before this formula was decided, used `[10, 40]`
  instead as a stand-in range -- that was never meant to match the real formula, just to prove the
  toolchain; this is the correction.)
- **Sectors get an *additive*, not multiplicative, bonus.** Multiplicative scaling (`baseRoll * (1 +
  sectors * rate)`) would need in-circuit division, which is possible in circom (witness-supplied
  quotient/remainder plus range checks) but adds real constraint-count and risk for a formula whose exact
  balance isn't finalized yet (see "Exact numeric balancing... needs its own pass," below, still true).
  Additive keeps the circuit simple (pure multiplication by a small constant) while still making the
  documented promise real: `gameplay.html` already says Sectors make "your Phishing more efficient" and
  `bunker.html`'s disabled Build Infrastructure card says the same -- this is that promise, implemented
  plainly. Revisit multiplicative scaling once real economy numbers are being tuned.
- **Only Infrastructure gets a Phish bonus, not all five specializations.** Section 01 describes
  Infrastructure as "automated data-farming loops, server rack expansion" -- the only specialization whose
  flavor text is actually about resource generation. Giving every specialization a Phish bonus would dilute
  the choice into "always pick whichever number is biggest"; giving only Infrastructure one keeps the other
  four specializations meaningful for *other* mechanics (Consensus for defense, Overclocking for Attack
  damage, Phantom for stealth/evasion, Darknet for hijacking-related payloads) once those get built. This is
  a design choice, not a forced one -- revisit if playtesting shows Infrastructure is over- or
  under-valued relative to the other four once they have their own payoffs.
- **`researchTier` is deliberately not a term here.** Research is documented as unlocking "hack/payload
  tiers" (Attack-side systems, Section 03), not yield efficiency -- keeping it out of the Phish formula
  keeps each stat tied to a specific strategic choice instead of every stat mattering for everything.
- **This degrades gracefully to today's live behavior.** `sectors` and `nodeSpec` are already reserved
  fields in the on-chain game-state snapshot (`encodeGameStateSnapshot` in `kaspa-client.js`), written as
  `0`/`UNSET` today since neither mechanic is built yet ("same honesty convention already used for $PUNKW
  before Phish existed" -- see that function's own comment). With `sectors=0` and `nodeSpec=UNSET`, this
  formula reduces to `yieldAmount = baseRoll` -- i.e. it already matches what every current player
  effectively has, and activates progressively as Sector-building and Node Specialization selection
  actually ship. No player's effective yield changes the day this formula goes live.

**Still open, same caveats as the rest of this doc:** the exact bonus constants (`SECTOR_YIELD_BONUS=2`,
`NODE_SPEC_INFRA_BONUS=15`) are a reasonable first pass, not playtested numbers -- expect them to move once
real balancing happens. `sectors` is range-checked in the circuit (bounded, currently `< 200`) purely to
keep the constraint system sane, not as a hard game-design cap. How the covenant verifies `sectors`/
`nodeSpec` themselves are the player's *true, current* values (not just self-reported alongside the proof)
is unsolved -- this formula proves "yield Z follows correctly *from* these sectors/nodeSpec inputs," not
"these inputs are honest." That's a state-continuity problem (checking against the operator's own previous
on-chain snapshot, plausibly via the payload-inspection opcodes `OpTxPayloadLen`/`OpTxPayloadSubstr` noted
as unexercised in the Phase 4.5 notes) that needs its own design pass before this ships as a real covenant,
not just a circuit.

## Open questions for implementation (not yet decided)

- Which of these (units, payloads, items) need real on-chain enforcement via covenants (Phase 7 territory,
  following the pattern proven in the faucet vault) versus which are purely client-side game state derived
  from payload-tagged transactions (Phase 4-6 pattern, following Genesis/Phish)? Likely: high-stakes combat
  outcomes (Attack payloads, Zero-Day Exploit) warrant covenant enforcement; passive economy (Infrastructure,
  upkeep ticking) probably doesn't.
- Exact numeric balancing (AP/HP values, costs in $PUNKW, drop rates) is not specified here and
  needs its own pass once a system is actually being built.
- How Node Specialization (the five alignments) is chosen/locked-in per operator, and whether it's
  changeable, isn't decided.
