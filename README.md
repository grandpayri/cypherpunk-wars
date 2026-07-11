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
