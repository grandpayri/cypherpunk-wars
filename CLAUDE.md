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

`sitemap` in the repo root is the authoritative page-by-page design doc — read it before adding a new page. It documents pages that **do not exist yet** and are referenced as nav links/planned features but have no file: `resume.html`, `leaderboard.html`, `attack.html`, `research.html`, `hack.html`. `bunker.html`'s sidebar already links to some of these.

## Kaspa/WASM integration

- `kaspa.js` + `kaspa_bg.wasm` are wasm-bindgen-generated bindings for the Kaspa WASM SDK (large generated file — don't hand-edit it).
- `wallet-gen.js` is the project's thin wrapper around it: `bootBunkerEngine()`, `forgeNewIdentity()`, `syncBunkerIdentity(mnemonic)`.
- **Known integration bug**: `kaspa.js` uses top-level ES `export` statements (real ES module), but `forge.html`/`import.html` load it with a plain `<script src="kaspa.js">` (no `type="module"`) — this will throw a `SyntaxError` at runtime, not silently fail. `wallet-gen.js` also destructures `const { Wallet, initKaspaFramework, Mnemonic } = kaspa;` off a global `kaspa`, but `kaspa.js` has no such global and no export named `initKaspaFramework` (its init entry point is a default export, `__wbg_init`). Any work touching wallet forge/import needs to fix this wiring (module scripts + import the actual init export) rather than assuming it currently works.
- The one piece of chain interaction actually wired up is in `bunker-logic.js`: `getAddressBalance()` / `sendGameTransaction()` are called but not defined anywhere in the repo yet — treat them as the next integration point, not existing utilities.

## State & persistence

- The only persisted client state is `localStorage['bunker_id']` (the derived Kaspa address), used both as the "is there a saved session" check on `index.html` and as the identity key everywhere else, plus per-identity `localStorage['punkw_balance_<address>']`/`localStorage['turn_count_<address>']` caches (see `shared-sidebar.js`'s `getPunkwBalance`/`setPunkwBalance`/`getTurnCount`/`setTurnCount`) kept in sync with the full game-state snapshot written into every Genesis/Phish payload.
- Sectors are a real planned mechanic (Phase 6, not yet built) shown as a fixed placeholder in the sidebar; there is no GWh or Cycles system — those were an earlier, incorrect design pass and have been removed from both the docs and the UI.

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
