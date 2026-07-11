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
"these inputs are honest." That's a state-continuity problem, and it splits into two separately-solvable
pieces -- see "Trust model: what's enforced and what isn't" below for the full picture, since one piece
was actually closed on 2026-07-11 and one deliberately wasn't.

## 07. Trust Model: What's Enforced On-Chain and What Isn't (2026-07-11)

A long conversation this session pushed on "the chain needs to verify your gamestate," not just "can a
player recover their own cached number." Worth a dedicated section since it's the honest answer to "is
this actually trustless," and it's more nuanced than a yes/no.

**Closed: per-transaction yield integrity.** Before this date, `OpZkPrecompile` verified that a Phish's
ZK proof was *valid*, but nothing on-chain constrained what the transaction's `CPW1` payload actually
*declared* -- a modified client could generate an honest proof for a yield of 25 and still write
`punkw: 999999999` into the payload, since the covenant never read the payload at all. Fixed: the
covenant's real-claim branch now extracts a `provenYieldHex` field from the payload (32 bytes, appended
after the existing 42-byte game-state body -- see `kaspa-client.js`'s `PROVEN_YIELD_BYTES`) via
`OpTxPayloadSubstr` (KIP-10, `0xb8`) and requires it to exactly equal the proof's own public `yieldAmount`
output. Confirmed on-chain both ways -- an honest payload is accepted, a payload declaring a different
(also proof-backed, just *wrong* for *this* transaction) yield is rejected with "false stack entry at end
of script execution" -- via `zk-spike/onchain-test-payload-binding.html` before landing in the live
covenant. This is real, cryptographic, network-enforced integrity for a single roll: nobody, running any
client, can claim a yield the proof doesn't back.

**Still open: cumulative total integrity.** Binding *this transaction's* declared yield to *its own* proof
says nothing about whether `newPunkwTotal = previousTotal + yieldAmount` was computed against a genuine
previous total. KIP-10's introspection opcodes are confirmed (via direct research against rusty-kaspa's
own spec) to only read the *current* transaction's own fields -- there is no opcode that lets a covenant
read an ancestor transaction's payload, so the covenant cannot verify `previousTotal` against on-chain
history the way it can now verify `yieldAmount`. Closing this fully requires either (a) making $PUNKW a
real, sompi-backed value so Kaspa's native amount-conservation does the chaining for free (a genuine
economic redesign, not a bugfix), or (b) proof-chaining `previousTotal` as a public input sourced from an
archival read of the player's own last transaction (see below) -- neither attempted yet.

**Still open: payload durability.** Kaspa's default (non-archival) nodes discard transaction/payload data
after roughly 3 days (confirmed both by rusty-kaspa's own pruning documentation and empirically this
session -- see `kaspa-client.js`'s `fetchTransactionPayloadBytes` comment). An `--archival` node retains
this data indefinitely, but no archival RPC access is wired into this project as of this date (deliberately
not pursued -- no archival infrastructure available). This means: even the newly-enforced per-transaction
integrity above is only *checkable* within roughly that 3-day window unless someone is separately
archiving payloads: after that, the underlying transaction still did the right thing (that's permanent,
baked into DAG consensus), but re-verifying exactly what it declared is no longer possible without
archival access.

**Bottom line, stated plainly: this project has not solved trustless verification of a player's
cumulative game state, only of each individual Phish roll.** Do not treat any $PUNKW total as
independently auditable today, and **this app must not be pointed at mainnet or handle real value until
both open items above are closed.** Testnet-10 (TKAS) only, no exceptions, until this section says
otherwise.

## 08. Turns Model (decided 2026-07-11)

`gameplay-balance.md` (a full GDD for the unbuilt combat/spellbook/Armageddon systems) proposed Turns as
a free, passive resource that auto-accumulates over real-world time (+1 every 10 minutes, capped at 200).
**Rejected.** The live game's Turns are a *paid* resource -- bought with real KAS via `buyTurns()`
(`send.html`), priced at `COST_PER_TURN_SOMPI` (~0.405 TKAS, covering the ZK-Phish anchor + claim
transactions), never free. This is a deliberate, user-stated convention from this project's history:
buying Turns is a player's *entire* financial outlay to play, nothing else touches their Plain Wallet.
A parallel free-regeneration source would undercut that convention and the Faucet/Gameplay/Prize vault
self-funding loop built around it (see `kaspa-client.js`'s ZK-Phish covenant section). **Kept from the
GDD:** the per-action Turn *costs* it proposes (Phish = 1, Build Sector = 2, Recruit Unit = 1, etc.) are
compatible with the paid model as-is -- they describe consumption, not the source of supply, so they
remain a reasonable starting point once those actions are actually built.

**Starter funding, resolved 2026-07-11.** `forge.html` (merged with the former `initialize.html` into
one continuous onboarding flow the same day) grants a new player enough to cover Genesis plus a real
`buyTurns()` purchase of **22 Turns** (~8.91 TKAS into the Gameplay Vault), not the "~25" figure Gemini
originally floated -- `computeDepositForTurns(25)` (11.13 KAS) exceeds `FAUCET_GRANT_CAP_SOMPI` (10 KAS,
the Faucet Vault covenant's own hard single-grant ceiling, enforced on-chain), and raising that cap would
mean migrating the Faucet Vault to a new covenant address. 22 is the max that fits with fee headroom;
close enough to the original target to not warrant a covenant migration.

Building this surfaced a real, previously-latent bug in `buyTurns()` itself: sizing the deposit to
consume a wallet's balance down to a small, imprecise remainder can leave a dust-sized change output,
which KIP-9's storage-mass formula (`storage_mass = C*(sum(1/output) - |inputs|^2/sum(input))^+`,
`C=10^12`, confirmed against rusty-kaspa's own KIP-9 spec) punishes heavily enough to get the transaction
rejected outright ("Storage mass exceeds maximum") -- confirmed live, twice, before landing on a fixed
deposit target instead of a computed "whatever's left" one. See the caution comment above `buyTurns()`
in `kaspa-client.js`: any future caller that tries to drain a wallet down to a small, imprecise leftover
risks hitting this same rejection.

## 09. Covenant Scalability: the VK-Hash Pattern (decided 2026-07-11)

Raised directly: does the branched-covenant pattern (one Gameplay Vault, one `OpIf`/`OpElse` per
action type) scale to the full mapped roadmap -- Build Sector, Attack, Research, Hack/Armageddon,
each with their own ZK circuit? As originally built, **no** -- concretely fixable, but worth recording
why and what was changed.

**The problem:** a P2SH covenant's entire redeem script must be pushed on-chain on every spend,
regardless of which branch actually executes -- skipped branches cost no *mass* to run, but the
*script itself* still has to be there for the hash check. The original Phish covenant baked the full
~392-byte verifying key directly into the redeem script. Every additional ZK-proven action type would
add its own ~300-400 byte VK to that same shared script, meaning even a cheap anchor spend -- which
never touches any of those branches -- would get steadily more expensive as unrelated features shipped.
Directly at odds with "keep turn costs as low as possible."

**The fix:** the redeem script now stores only a 32-byte `OpBlake2b` hash of the VK
(`PHISH_YIELD_VERIFICATION_KEY_HASH_HEX` in `kaspa-client.js`), not the VK itself. The real VK is
supplied by the sig script at spend time and `OpDup`'d so one copy is hash-checked against the stored
hash while the surviving copy feeds `OpZkPrecompile` exactly as before. Each new action type now adds
a small, constant-size hash comparison (~32-40 bytes) to the shared script instead of a few hundred
bytes -- turn cost stays roughly flat as the game grows, rather than climbing with every feature ever
added, whether or not a given turn uses it. Confirmed on-chain in two steps before touching the live
covenant: first, that a JS-computed `blake2b(32)` hash (via the `blake2b` npm package) matches Kaspa's
on-chain `OpBlake2b` byte-for-byte (different blake2b library configs aren't guaranteed to agree);
second, that the full `OpDup`+`OpBlake2b`+hash-check+`OpZkPrecompile` chain works correctly both ways
(honest VK accepted, tampered VK rejected) -- see `zk-spike/README.md` for the transaction record.

**What this does NOT fix, on purpose -- three separate, still-open concerns:**
- **Nesting/audit complexity still grows with each branch added.** The hash trick keeps the *script
  small*; it doesn't make reasoning about a 5-6-level-deep nested `OpIf`/`OpElse` tree easier, or
  guarantee that adding branch N+1 doesn't silently corrupt branch N's stack assumptions. Two real bugs
  were hit this session adding just *one* payload check to an *already-working* covenant -- each new
  action still needs its own careful, on-chain-verified accept/reject testing, hash trick or not.
- **Every covenant script change still orphans existing funded vaults.** The address *is* a hash of the
  script; adding even a small hash-checked branch for a new action produces a new address. Fine
  repeatedly on testnet (the established convention all session); a real, unresolved liability for ever
  moving past it, since the hash pattern doesn't touch this at all.
- **State-continuity (section 07) is completely orthogonal.** A smaller, more scalable script doesn't
  make a player's self-reported *previous* total any more verifiable. Every new action built this way
  inherits section 07's open item independently -- covenant scalability and state trustlessness are two
  different problems that happen to both live in the same script.

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
