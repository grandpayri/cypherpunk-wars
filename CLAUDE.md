# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cypherpunk Wars is a serverless, decentralized browser game built entirely from static HTML/CSS/JS — there is no backend, no build step, and no package.json. The game logic lives on the Kaspa BlockDAG rather than a database: player actions are broadcast as Kaspa transactions carrying a native `payload` field tagged `CPW1` (see `kaspa-client.js`'s `encodePayload`/`decodePayload`), and the client reconstructs game state by scanning the chain. Kaspa has no Bitcoin-style `OP_RETURN`, and "vprogs" (Verifiable Programs) are a real but not-yet-live Kaspa roadmap concept — don't describe either as the current mechanism. See `architecture.html` and `whitepaper.html` (repo root, not a subfolder) for the in-fiction explanation of this design, and `design-bible.md` (also repo root) for the developer-facing mapping of legacy *Archmage* mechanics onto CPW systems.

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

- `kaspa.js` + `kaspa_bg.wasm` are wasm-bindgen-generated bindings for the Kaspa WASM SDK (large generated file — don't hand-edit it).
- `wallet-gen.js` is the project's thin wrapper around it: `bootBunkerEngine()`, `forgeNewIdentity()`, `syncBunkerIdentity(mnemonic)`.
- **Known integration bug**: `kaspa.js` uses top-level ES `export` statements (real ES module), but `forge.html`/`import.html` load it with a plain `<script src="kaspa.js">` (no `type="module"`) — this will throw a `SyntaxError` at runtime, not silently fail. `wallet-gen.js` also destructures `const { Wallet, initKaspaFramework, Mnemonic } = kaspa;` off a global `kaspa`, but `kaspa.js` has no such global and no export named `initKaspaFramework` (its init entry point is a default export, `__wbg_init`). Any work touching wallet forge/import needs to fix this wiring (module scripts + import the actual init export) rather than assuming it currently works.
- The one piece of chain interaction actually wired up is in `bunker-logic.js`: `getAddressBalance()` / `sendGameTransaction()` are called but not defined anywhere in the repo yet — treat them as the next integration point, not existing utilities.

## State & persistence

- The only persisted client state is `localStorage['bunker_id']` (the derived Kaspa address), used both as the "is there a saved session" check on `index.html` and as the identity key everywhere else, plus per-identity `localStorage['punkw_balance_<address>']`/`localStorage['turn_count_<address>']` caches (see `shared-sidebar.js`'s `getPunkwBalance`/`setPunkwBalance`/`getTurnCount`/`setTurnCount`) kept in sync with the full game-state snapshot written into every Genesis/Phish payload.
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
- **$PUNKW (War Chest)** — earned by Phishing. Every Genesis/Phish transaction writes the operator's *entire* current game state (a fixed-width, versioned 42-byte struct — $PUNKW, sectors, node specialization, research tier, turn count, season, unit/item counts) into that transaction's payload (`encodeGameStateSnapshot`/`decodeGameStateSnapshot` in `kaspa-client.js`), not just $PUNKW or an action tag. Fields not backed by real gameplay yet are written as `0`.
- **Sectors** — planned (Phase 6, not built): built by spending $PUNKW, increasing Phishing efficiency.
- **Armageddon** — planned (Phase 7, not built): a covenant-verifiable season-ending reset, cast like other future hack/DOS payloads.

## Visual/UI conventions

Shared look defined in `style.css`: dark terminal aesthetic, monospace (`Courier New`), CSS custom properties `--kaspa-teal`, `--kaspa-bright`, `--bunker-bg`, `--hazard-yellow`. Recurring patterns to reuse rather than reinvent:
- `.btn-execute` / `.btn-danger` for actions.
- `#log.terminal-log` box on every page, updated via an `updateStatus(msg)` helper that appends `> message` lines (duplicated per-page in `bunker-logic.js` and `initialize.js` — keep the same signature if adding it elsewhere).
- ASCII-art logo block (see `asciilogo`) reused verbatim in `index.html`/`bunker.html`.
