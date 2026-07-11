Here is the complete, cohesive Game Design Document containing all the mechanics, math, and the updated cartel-style payout loop, ready to be handed off to Claude.



\---



\# Game Design Document: Cypherpunk Wars (CPW)



\## 1. High-Level Gameplay Concept



\*\*Cypherpunk Wars (CPW)\*\* is an asynchronous, text/UI-driven strategy war game built on a single-faction archetype: every player is a hacker group fighting for absolute dominance over \*\*The Grid\*\*. The core loop is driven by a time-accumulated currency called \*\*Turns\*\*. The ultimate goal is to build up enough infrastructure to successfully compile and execute the \*\*Armageddon\*\* script, ending the season and winning the server.



\---



\## 2. Core Game Currencies \& Values



| Asset | Type | Purpose | How it is Obtained |

| --- | --- | --- | --- |

| \*\*Turns\*\* | Time Token | The fundamental action economy. | Automatically accumulates over real-world time (e.g., +1 Turn every 10 minutes). Max cap: 200. |

| \*\*$PUNKW\*\* | Soft Currency | Internal fiat used to fund assets. | Generated primarily by Phishing or raiding other players. |

| \*\*Sectors\*\* | Infrastructure | Grid real estate. Acts as a multiplier. | Built using Turns and $PUNKW. |

| \*\*Units\*\* | Standing Army | Used for offensive raids and defense. | Recruited using Turns and $PUNKW. |

| \*\*Compute\*\* | Tech Progress | Unlocking the Spellbook. | Generated dynamically by assigning Turns to Research. |



\---



\## 3. The Economic Core Loop



\### Phishing \& The Sector Multiplier



The primary way to generate $PUNKW is the \*\*Phish\*\* action. To prevent early-game compounding from completely breaking the game balance, its payout scales logarithmically based on a player's hardware footprints (Sectors).



$$\\text{Phish Payout} = \\text{Base Payout } (150\\ \\text{\\$PUNKW}) \\times \\left(1 + \\ln(\\text{Sectors} + 1)\\right) \\times \\text{Random\\\_Multiplier } (0.8 \\text{ to } 1.3)$$



\* \*\*Design Intent:\*\* Going from 1 Sector to 10 Sectors grants a massive yield bump. Going from 500 to 510 Sectors yields marginal gains. This forces players to transition from pure eco-building to warfare or military accumulation.



\### Action Cost Sheet (Hypothetical Values)



\* \*\*Phish:\*\* Costs 1 Turn.

\* \*\*Build Sector:\*\* Costs 2 Turns + $PUNKW scaling cost ($\\text{Current Sectors} \\times 50\\ \\text{$PUNKW}$).

\* \*\*Recruit Unit:\*\* Costs 1 Turn + specific unit $PUNKW flat cost.



\---



\## 4. The Roster (Unit Types \& Army Synergy)



Combat limits players to their \*\*Top 10 Stacks by Net Power\*\* entering battle, preventing low-tier "spam drowning." Units feature explicit movement types (Physical vs. Digital) and passive synergy tags.



\### Tier 1: Low-Investment Hardware



\* \*\*Scrap Drones (Physical/Melee):\*\* Cheap meatshields.

\* \*Cost:\* 10 $PUNKW.

\* \*Synergy:\* \*\*\[Chaff]\*\* Automatically absorbs the first 10% of total incoming physical damage dealt to your entire army.





\* \*\*Packet Sniffers (Digital/Support):\*\* Zero combat power, fast movement.

\* \*Cost:\* 15 $PUNKW.

\* \*Synergy:\* \*\*\[Data Leak]\*\* If your army wins an attack, every 100 surviving Packet Sniffers steal an extra 2% of the defender's stored $PUNKW.







\### Tier 2: Specialized Exploits



\* \*\*Logic Bombs (Digital/Kamikaze):\*\* Mid-tier high impact.

\* \*Cost:\* 150 $PUNKW.

\* \*Synergy:\* \*\*\[Mutually Assured Destruction]\*\* Triggers at the start of combat before main calculations. Completely deletes itself along with an equivalent Net Power amount of the enemy's highest-tier digital units.





\* \*\*Street Sams (Physical/Ranged):\*\* High consistent damage.

\* \*Cost:\* 200 $PUNKW.

\* \*Synergy:\* \*\*\[Overclock Synergy]\*\* Gains a flat +20% damage modifier if the player has an active "Packet Injection" buff running on their system.







\### Tier 3: High-End Mainframe Threats



\* \*\*AI Daemons (Digital/Flier):\*\* The apex units. High power, bypasses ground shields to hit backline support units directly.

\* \*Cost:\* 1,500 $PUNKW.

\* \*Synergy:\* \*\*\[System Domination]\*\* Reduces the total defensive power calculation of the enemy's Firewalls by 15%.







\---



\## 5. The Spellbook (Research \& Casting)



Players allocate Turns and $PUNKW into a chosen script blueprint. Every script has a \*\*Difficulty Factor\*\*.



$$\\text{Research Success Chance} = \\left( \\frac{\\text{Turns Spent}}{\\text{Spell Difficulty Factor}} \\right) \\times 100\\%$$



\* \*Example:\* If a spell has a Difficulty Factor of 20, committing 5 Turns to the action gives a flat 25% chance to permanently unlock that blueprint.



\### Proposed Matrix



| Spell Name | Difficulty Factor | Strategic Intent | Mechanics |

| --- | --- | --- | --- |

| \*\*Packet Injection\*\* | 10 | Early-Game Eco Buff | Costs 5 Turns to cast. Doubles all Phish payouts for the next 6 real-world hours. |

| \*\*Sybil Swarm\*\* | 25 | Mid-Game Army Spawner | Costs 12 Turns to cast. Instantly generates 200-500 Scrap Drones directly into your army pool for 0 $PUNKW cost. |

| \*\*Ransomware\*\* | 40 | Hostile Sabotage | Costs 15 Turns to cast. Target an enemy address. If successful (passed enemy Firewalls), locks down 30% of their $PUNKW pool. Caster receives 5% of it every hour for 6 hours unless the defender spends 10 Turns to "Purge." |

| \*\*Zero-Day Vulnerability\*\* | 60 | Tactical Warfare | Costs 20 Turns to cast. Target an enemy address. Completely disables their ability to execute the \*\*Recruit\*\* or \*\*Build\*\* action for the next 12 hours. |

| \*\*ARMAGEDDON\*\* | 500 | End Game Trigger | Costs 50 Turns to cast. Initiates the server-wide end-game state. |



\---



\## 6. The Combat Resolution Engine



Combat is an asynchronous, deterministic clash of mathematical weights modified by unit composition, movement types, and defensive infrastructure. When a player initiates an attack, they pull a snapshot of the defender's current state.



\### 6.1 Attack Composition: The Top 10 Stacks Rule



To prevent players from overwhelming opponents through sheer numbers of low-tier units ("spam drowning"), an army's effectiveness is constrained by bandwidth:



\* \*\*The Bandwidth Cap:\*\* Only a player's \*\*Top 10 unit stacks ranked by individual Stack Net Power\*\* actively participate in the calculation.

\* Any units outside the top 10 stacks are treated as reserve resources; they do not contribute to combat power and cannot be killed during the engagement.



\### 6.2 The Core Combat Calculation



The battle resolves in three consecutive, deterministic phases based on unit attributes and defensive structures.



\#### Phase 1: Infrastructure Mitigation (Sectors \& Firewalls)



Before units clash, the defender's infrastructure absorbs and mitigates the incoming attack payload.



\* \*\*Sector Density (Passive Armor):\*\* The defender’s total number of \*\*Sectors\*\* acts as a structural buffer. The base offensive power of the attacker's \*\*Physical\*\* units (Drones, Street Sams) is reduced by a flat percentage based on how heavily dug-in the defender is:



$$\\text{Physical Damage Reduction \\%} = \\min\\left(75\\%, \\frac{\\text{Defender Sectors}}{10}\\right)$$





\* \*\*Firewall Spells (Digital Hardening):\*\* If the defender has active defensive software running (e.g., \*Deep Encryption\*), the base offensive power of the attacker's \*\*Digital\*\* units (Daemons, Logic Bombs) is reduced by a flat percentage (typically 50% to 75%).



\#### Phase 2: Priority Striking \& Movement Multipliers



Once infrastructure mitigation is applied, the standing armies clash. Units deal damage simultaneously within their priority brackets, multiplying their modified power against opposing stacks:



1\. \*\*Ranged \& Digital Support (Priority 1):\*\* Street Sams and Packet Sniffers strike first. Digital support units do not deal damage but apply dynamic status modifiers or drain resources during this phase.

2\. \*\*The Vanguard Clash (Priority 2):\*\* Physical Melee units (Scrap Drones) engage. They possess a 1.5x combat efficiency multiplier against other ground units but must completely chew through the enemy's front-line physical stacks before they can damage back-line support units.

3\. \*\*The Air/Network Domain (Priority 3):\*\* AI Daemons (Flying/Digital) execute their scripts. Due to their movement type, they possess a 2.25x efficiency multiplier and \*\*bypass the physical front-line entirely\*\*, dealing their damage directly to the defender's highest-value Ranged or Support stacks.



\#### Phase 3: Casualty Allocation \& Mission Resolution



Damage is applied as straight health/power deductions across the stacks. If the attacker’s total surviving Net Power exceeds the defender's surviving Net Power, the attacker wins the node and executes their chosen mission vector:



\* \*\*Vector A: Raid (Resource Extraction)\*\*

\* \*\*The Yield:\*\* The attacker does not affect the defender's infrastructure. Instead, they plunder the defender's financial vault, stealing a percentage of unspent $PUNKW.

\* \*\*The Scale:\*\* The maximum amount stolen is capped at 50% of the defender's total pool, scaled by how decisively the attacker won the Net Power calculation. If Packet Sniffers survived the breach, their \*\*\[Data Leak]\*\* synergy triggers here, extracting an additional premium from the defender's reserves.





\* \*\*Vector B: Raze (Infrastructure Scorched-Earth)\*\*

\* \*\*The Yield:\*\* The attacker ignores the financial vault entirely. Their surviving forces target the hardware layer to break the defender's economy.

\* \*\*The Scale:\*\* The attacker permanently deletes a percentage of the defender’s total \*\*Sectors\*\* (up to 15% per successful execution). This immediately forces the defender's \*\*Phish Payout\*\* calculation down the logarithmic curve, crippling their ability to fund future recruitment or rapid rebuilding.







\---



\## 7. The Armageddon Finale Loop



\### Preconditions to Cast



A player cannot attempt to trigger the finale unless they meet these severe resource requirements:



1\. Must have successfully completed the \*\*Armageddon Blueprint\*\* Research (Difficulty 500).

2\. Must possess a minimum structural footprint of \*\*500 Sectors\*\*.

3\. Must lock up a baseline collateral stake of \*\*50,000 $PUNKW\*\*.



\### The 24-Hour Blackout Lock



Once the 50-Turn cast transaction is initialized, the following operational changes occur globally:



\* \*\*The Caster Lock:\*\* The caster enters a dead-state lockdown. For 24 real-world hours, they \*\*cannot\*\* Phish, Build, Recruit, Cast other spells, or launch standard attacks. They are completely exposed, relying entirely on their standing unit stacks to defend them.

\* \*\*The Server Target:\*\* The caster's address is broadcast to the global UI system with a live 24-hour countdown timer.



\### Interruption \& Defensive Attrition Rules



The remaining server population must actively cooperate or compete to crack the caster's defense before the timer hits 0.



1\. \*\*The Attrition Latency Penalty:\*\* Every successful \*\*Raid\*\* won by an attacking player against the caster injects noise into their compiling engine. Each successful breach adds \*\*+30 minutes\*\* to the remaining Armageddon countdown timer, prolonging their vulnerability window.

2\. \*\*Critical Failure / Caster Crash:\*\* If enemy players focus heavily on \*\*Raze\*\* attacks and successfully reduce the caster's standing infrastructure below the absolute baseline requirement (\*\*under 400 Sectors\*\*), the Armageddon exploit fails structurally. The countdown terminates, the season remains open, and the caster's staked 50,000 $PUNKW is completely obliterated.



\### Execution \& The Cartel Payout



If the timer reaches zero and the caster has successfully protected their hardware above the critical 400 Sector floor, the script executes and the season terminates. The \*\*Games Prize Vault\*\* is immediately distributed to foster endgame alliances and betrayal:



\* \*\*70% Payout:\*\* Routed to the Armageddon Caster.

\* \*\*20% Payout:\*\* Routed to the player holding the 2nd highest total Net Power on the server at the exact moment of execution.

\* \*\*10% Payout:\*\* Routed to the player holding the 3rd highest total Net Power on the server at the exact moment of execution.



Following the payout, the server wipes completely to a fresh genesis state.



\---



\## 8. Development Review Prompts for Claude



1\. \*\*The Logarithmic Curve:\*\* Does the proposed `1 + ln(Sectors + 1)` curve create a sufficient bottleneck to naturally force passive turtling players into high-risk offensive gameplay styles in the mid-game?

2\. \*\*The Combat Queue UI:\*\* Given the turn-based latency of asynchronous play, how should the UI structure the army layout so players can easily see the overlapping aura math of their top 10 stacks before launching a mission?

3\. \*\*The Sector Armor Cap:\*\* Does capping the passive physical damage reduction at 75% (achieved at 750 Sectors) provide an adequate turtle defense, or will it make high-tier players virtually immune to physical raiding without heavy AI Daemon investment?

4\. \*\*Casualty Ordering:\*\* To keep calculations clean in an asynchronous loop, should casualties be distributed proportionally across all 10 active stacks, or should they strictly deplete the lowest-tier stacks (meatshields) first until they are wiped out?

5\. \*\*Armageddon Counter-Play Balance:\*\* Is a simple 400-Sector floor too easy to break via server-wide dogpiling, or does the 24-hour lock properly balance risk vs. reward for a dominant player?

6\. \*\*The Payout Snapshot:\*\* When Armageddon executes, what is the most efficient way to snapshot and index the 2nd and 3rd highest Net Power players across the entire ledger without causing a massive state-calculation spike?

