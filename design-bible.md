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
| Meteor Storm | **Cascading Hardware Failure** | Persistent heavy-bandwidth malware degrading an opponent's Sector efficiency over time; costs continuous GWh to sustain (matches legacy's constant mana drain on the caster) |
| Chain Lightning | **Distributed Denial of Service (DDoS)** | Severe damage to one target, weaker bleed-over to secondary infrastructure |
| Platinum Hand of Healing / Regeneration | **Data Scrubbing & Backup Restore** | Restores corrupted operational data from local backups; brings disconnected servers back online |
| Disintegrate | **Zero-Day Exploit** | Instantly wipes a specific enemy daemon; unblockable, highly targeted |
| Letters of the Thieves' Guild | **Phishing Payload** | Siphons $PUNKW directly from an enemy's war chest, or steals high-tier firmware |

## 04. Item & Hardware Mapping

Items become hardware expansions, firmware upgrades, or cryptographic keys installed into a Bunker.

| Legacy Item | CPW Item | Effect |
|---|---|---|
| Coffin | **Pre-Packaged Botnet Drive** | Randomly grants ~2,000 hijacked devices (Zombie-tier), ~1,000 (Ghoul-tier), or 20 (Lich-tier) without manual compiling |
| Potion of Valor | **Overclock Firmware** | +20% offensive execution cycles (AP), temporary |
| Bubble Wine | **Thermal Paste Syringe** | +10% offense, +30% effective HP (advanced cooling lets hardware run hotter, take more punishment) |
| Blood Stained Map | **Compromised Routing Ledger** | Cumulative +15% chance to discover rare, decentralized nodes (legacy: Holy Grails) |
| Oil Flasks & Pixie Dust | **Firewall Degradants** | Permanently lowers a target's cryptographic resistance to subsequent inbound attacks |

## 05. Infrastructure & Economy Mapping

The physical kingdom layout maps to the physical data center layout.

| Legacy System | CPW System | Notes |
|---|---|---|
| Workshops & Build Rate | **Compiling Nodes** | Dictates how fast new Sectors can be spun up |
| Guilds & Nodes | **Validator Network** | Generates incoming GWh fuel reserves (Kaspa validator setups) |
| Upkeep (Mana/Gold) | **Power Consumption (GWh / $PUNKW)** | Failing to maintain upkeep disbands units/payloads, same as legacy TR |

## Open questions for implementation (not yet decided)

- Which of these (units, payloads, items) need real on-chain enforcement via covenants (Phase 7 territory,
  following the pattern proven in the faucet vault) versus which are purely client-side game state derived
  from payload-tagged transactions (Phase 4-6 pattern, following Genesis/Phish)? Likely: high-stakes combat
  outcomes (Attack payloads, Zero-Day Exploit) warrant covenant enforcement; passive economy (Infrastructure,
  upkeep ticking) probably doesn't.
- Exact numeric balancing (AP/HP values, costs in GWh/Cycles/$PUNKW, drop rates) is not specified here and
  needs its own pass once a system is actually being built.
- How Node Specialization (the five alignments) is chosen/locked-in per operator, and whether it's
  changeable, isn't decided.
