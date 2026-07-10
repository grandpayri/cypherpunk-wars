# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cypherpunk Wars is a serverless, decentralized browser game built entirely from static HTML/CSS/JS — there is no backend, no build step, and no package.json. Player actions are broadcast as Kaspa transactions carrying a native `payload` field tagged `CPW1` (see `kaspa-client.js`'s `encodePayload`/`decodePayload`, and `encodeGameStateSnapshot`/`decodeGameStateSnapshot` for the actual game-state struct written into it), and the client reconstructs game state by scanning the chain (see CPW History below). This briefly broke (payload attached but broke signing) due to the vendored Kaspa WASM SDK being outdated (**v0.15.2**, missing PR #591 "Enable payloads for non coinbase transactions" from v0.15.4-rc1) -- fixed 2026-07-10 by upgrading `kaspa.js`/`kaspa_bg.wasm` to **v2.0.1**. See the "PAYLOAD TAGGING HISTORY" comment above `sendTaggedTransaction` in `kaspa-client.js` for the full incident record; if payload tagging ever seems broken again, check the SDK version first (`(await import('./kaspa.js')).version()`) before re-diagnosing from scratch. Kaspa has no Bitcoin-style `OP_RETURN`, and "vprogs" (Verifiable Programs) are a real but not-yet-live Kaspa roadmap concept — don't describe either as the current mechanism. See `architecture.html` and `whitepaper.html` (repo root, not a subfolder) for the in-fiction explanation of this design, and `design-bible.md` (also repo root) for the developer-facing mapping of legacy *Archmage* mechanics onto CPW systems.

## Running locally

There is no build/lint/test tooling in this repo. To work on it:

- Serve the directory with any static file server, e.g. `python -m http.server 8000`, then open `http://localhost:8000/index.html`.
- Do **not** open the HTML files directly via `file://` — `kaspa.js` fetches `kaspa_bg.wasm` via `import.meta.url`, which requires an HTTP origin.
- Deployment targets both GitHub Pages (`.nojekyll`) and Cloudflare Pages (`_headers` sets the wasm MIME type), so keep asset paths relative and avoid anything that needs server-side processing.

## Page flow (multi-page app, no framework/router)

Navigation is plain `window.location.href = '...'` between standalone HTML files — there is no SPA framework, bundler, or client-side router. Each page has its own inline `<style>`/`<script>` plus the shared `style.css`.

Flow: `index.html` (login/detect saved session) → `forge.html` (generate new 24-word identity) **or** `import.html` (recover from existing seed) → `initialize.html` (claim genesis 1,000 $PUNKW) → `bunker.html` (main command-center loop, e.g. `executePhish()` in `bunker-logic.js`).

`sitemap` in the repo root is the authoritative page-by-page design doc — read it before adding a new page. `hack.html` is referenced there as a planned feature but has no file yet. `attack.html`/`research.html` exist as unlinked COMING_SOON placeholders — the persistent sidebar (`shared-sidebar.js`) no longer links to them, since Attack/Research are now options inside `bunker.html`'s Command Center action grid rather than separate nav destinations; the standalone pages are reserved for whenever those systems' actual interaction flow gets built.

## Kaspa/WASM integration

- `kaspa.js` + `kaspa_bg.wasm` are wasm-bindgen-generated bindings for the Kaspa WASM SDK (large generated file — don't hand-edit it; replace wholesale via an official release if it ever needs upgrading again, e.g. `https://github.com/kaspanet/rusty-kaspa/releases/download/vX.Y.Z/kaspa-wasm32-sdk-vX.Y.Z.zip`, `web/kaspa/` subfolder is the right browser/full-SDK target). Currently **v2.0.1** (check via `(await import('./kaspa.js')).version()`). Every page loads it as a real ES module (`<script type="module">`), matching `kaspa.js`'s top-level `export` statements.
- `wallet-gen.js` is the project's thin wrapper around it: `bootBunkerEngine()` (idempotent -- safe to call from multiple independent call sites, dedupes to one underlying WASM init), `forgeNewIdentity()`, `syncBunkerIdentity(mnemonic)`.
- All chain interaction lives in `kaspa-client.js`: `getAddressBalance()`, `sendTaggedTransaction()` (Genesis), `spendFromRestrictedWallet()` (Phish, covenant-signed), `requestFaucetGrant()`, `buyTurns()`, `fetchAddressTransactionList()`/`fetchTransactionPayloadBytes()` (CPW History's read side).
- The faucet covenant itself has no memory and will let any address claim repeatedly (rate-limited by the grant cap, not sybil-resistant — see the Phase 7 notes in the plan doc). `hasReceivedFaucetGrant(address)` in `kaspa-client.js` is a client-side-only courtesy check (queries the address's own tx history via REST for a prior incoming transfer from `FAUCET_VAULT_ADDRESS`) that `forge.html` calls before each grant so *our own UI* won't double-grant — not real sybil resistance, just stops the common case.

## State & persistence

- The only persisted client state is `localStorage['bunker_id']` (the derived Kaspa address), used both as the "is there a saved session" check on `index.html` and as the identity key everywhere else, plus per-identity `localStorage['punkw_balance_<address>']`/`localStorage['turn_count_<address>']` caches (see `shared-sidebar.js`'s `getPunkwBalance`/`setPunkwBalance`/`getTurnCount`/`setTurnCount`) kept in sync with the full game-state snapshot now genuinely written into every Genesis/Phish payload on-chain (confirmed live, decoded back out via `history.html`).
- Sectors are a real planned mechanic (Phase 6, not yet built) shown as a fixed placeholder in the sidebar; there is no GWh or Cycles system — those were an earlier, incorrect design pass and have been removed from both the docs and the UI.

## Explorer links

Every address and transaction ID displayed anywhere in the UI must be a clickable link out
to `https://tn10.kaspa.stream` (opens in a new tab, `target="_blank" rel="noopener"`) —
never inert text. Use `explorer-links.js`'s `addressLinkHtml(address, displayText?)` /
`txLinkHtml(txid, displayText?)` rather than hand-rolling an `<a>` tag; both accept an
optional truncated `displayText` while still linking the full value. Styled via the shared
`.explorer-link` class in `style.css`. If you add a new place that shows an address or
txid, wire it through these helpers rather than displaying raw text.

## CPW History (`history.html`)

Decodes an address's on-chain `CPW1` payloads into plain-language moves (e.g. "Executed
Phishing Attack -- Earned 47 $PUNKW"). Defaults to the operator's own Plain Wallet +
Gameplay Vault merged (Genesis lives on the former, Phish/Attack/Research on the latter);
can also look up any other address, though for a non-owned address there's no way to also
derive its Gameplay Vault without that operator's public key.

**Design credit:** both the state-snapshot payload model and this decode-your-own-history
approach were directly inspired by the ingenuity of the [Kasia](https://github.com/K-Kluster/Kasia)
team (K-Kluster) — an encrypted P2P messenger built on raw Kaspa transaction payloads. Their
public architecture (read real payload data straight off the chain; their own indexer is an
optional convenience for cross-device sync, not a hard requirement for basic use) is the
pattern this page follows, minus Kasia's own message encryption, which this game doesn't need.

**Why it needs two data sources, not one:** the testnet-10 REST indexer
(`api-tn10.kaspa.org`) has a full historical transaction list per address but runs
`simply-kaspa-indexer` with `--exclude-fields=tx_payload` — `payload` is always `null` from
it, confirmed empirically (even with `?fields=payload` requested explicitly), not fixable by
querying differently. Direct RPC (`rpc.getBlock`) *does* return real payload bytes, but Kaspa
nodes prune old blocks, so it only reaches back a limited, shrinking window. `kaspa-client.js`'s
`fetchAddressTransactionList()` (REST, for the list) + `fetchTransactionPayloadBytes()` (RPC,
best-effort per-entry decode) combine both: full decode for anything recent, graceful
"undecodable (pruned)" fallback for older entries — zero new backend infrastructure needed.

`fetchTransactionPayloadBytes()` returns `undefined` (RPC couldn't check) as distinct from a
zero-length `Uint8Array` (RPC checked fine, transaction genuinely has no payload — e.g. a
plain send or a `buyTurns()` deposit). Conflating the two mislabels ordinary non-CPW
transactions as pruned — a real bug hit once while building this; don't reintroduce it.

## Game terminology (needed to work on gameplay logic)

Defined in `gameplay.html`:
- **Turns** — each turn is a real Kaspa transaction, spent from the player's covenant-locked Gameplay Vault (see `kaspa-client.js`'s `spendFromRestrictedWallet`). Not a fictional resource; the network itself enforces what a turn can pay for.
- **$PUNKW (War Chest)** — earned by Phishing. Every Genesis/Phish transaction writes the operator's entire current game state (a fixed-width, versioned 42-byte struct — $PUNKW, sectors, node specialization, research tier, turn count, season, unit/item counts) into that transaction's on-chain payload (`encodeGameStateSnapshot`/`decodeGameStateSnapshot` in `kaspa-client.js`), confirmed live and decodable via `history.html`. `localStorage`'s punkw/turn-count cache (see State & persistence above) remains the sidebar's fast-path source of truth (no indexer for "current state" yet — see Phase 5 in the plan doc), kept in sync with what's on-chain.
- **Sectors** — planned (Phase 6, not built): built by spending $PUNKW, increasing Phishing efficiency.
- **Armageddon** — planned (Phase 7, not built): a covenant-verifiable season-ending reset, cast like other future hack/DOS payloads.

## Visual/UI conventions

Shared look defined in `style.css`: dark terminal aesthetic, monospace (`Courier New`), CSS custom properties `--kaspa-teal`, `--kaspa-bright`, `--bunker-bg`, `--hazard-yellow`. Recurring patterns to reuse rather than reinvent:
- `.btn-execute` / `.btn-danger` for actions.
- `#log.terminal-log` box on every page, updated via an `updateStatus(msg)` helper that appends `> message` lines (duplicated per-page in `bunker-logic.js` and `initialize.js` — keep the same signature if adding it elsewhere).
- ASCII-art logo block (see `asciilogo`) reused verbatim in `index.html`/`bunker.html`.
