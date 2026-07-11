# Cypherpunk Wars

A serverless, decentralized browser game built on the Kaspa BlockDAG — a Kaspathon entry
riffing on the BBS door game *Archmage*. There is no backend, no build step, and no
database: every player action is broadcast as a real Kaspa transaction, tagged with a
versioned `CPW1` payload carrying the operator's full game state, and the client
reconstructs the world by reading straight off the chain.

**Live:** https://grandpayri.github.io/cypherpunk-wars/ (testnet-10, TKAS — no real value)

## What's real right now

- **Identity** — a 24-word seed phrase, derived entirely client-side via a WASM build of
  the Kaspa SDK. No account, no server, no email.
- **Turns** — every Phish action is a real signed transaction spent from a per-player
  Toccata covenant (a "Gameplay Vault"): funds there are structurally locked to only leave
  via a valid game transaction, enforced by the network itself, not client code.
- **$PUNKW** — every Genesis/Phish transaction writes the operator's current game state
  on-chain. [CPW History](history.html) decodes any address's real moves straight from the
  BlockDAG.
- **A self-funding faucet** — new players are bootstrapped by a signature-free covenant
  vault, not a centralized faucet server.

See [`gameplay.html`](gameplay.html) for the player-facing manual, [`architecture.html`](architecture.html)
for how the WASM/covenant/payload plumbing fits together, and [`whitepaper.html`](whitepaper.html)
for the project's vision and Kaspathon goals.

## Testnet only — do not use with real funds

Each Phish action is backed by a real Groth16 proof, verified natively on-chain, and the network now
also enforces that the transaction's declared yield matches what that proof actually verified — a
modified client cannot claim a different number than the one it proved. **What isn't yet enforced:**
whether a player's *cumulative* running total was built from a genuine history of such transactions, and
whether that history stays independently checkable once Kaspa's default block pruning kicks in
(~3 days). See `design-bible.md` section 07 ("Trust Model") for the full, honest breakdown of what's
cryptographically guaranteed today versus what still relies on trusting the official client. **This
project stays on testnet-10 (TKAS, no real value) until those gaps are closed — never point it at
mainnet or real funds.**

## Running locally

No build tooling — it's static HTML/CSS/JS. Serve the directory with any static file
server and open it over HTTP (not `file://`, since the WASM binary is fetched via
`import.meta.url`, which requires an HTTP origin):

```
python -m http.server 8000
```

Then open `http://localhost:8000/index.html`.

## For developers

[`CLAUDE.md`](CLAUDE.md) has the full technical rundown (page flow, Kaspa/WASM
integration details, wire-format design, known gotchas). [`design-bible.md`](design-bible.md)
maps the legacy *Archmage* mechanics this project is built from onto Cypherpunk Wars
systems, for whatever's still being built out.
