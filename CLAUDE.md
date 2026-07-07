# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cypherpunk Wars is a serverless, decentralized browser game built entirely from static HTML/CSS/JS — there is no backend, no build step, and no package.json. The game logic is meant to live on the Kaspa BlockDAG rather than a database: player actions are (eventually) broadcast as Kaspa transactions with `OP_RETURN` memos ("vprogs" / Virtual Programs), and the client reconstructs game state by scanning the chain. See `documentation/architecture.html` and `documentation/whitepaper.html` for the in-fiction explanation of this design.

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

- The only persisted client state is `localStorage['bunker_id']` (the derived Kaspa address), used both as the "is there a saved session" check on `index.html` and as the identity key everywhere else.
- All other stats currently shown in `bunker.html` (GWh, $PUNKW, sectors, cycles) are placeholders/random values (see `refreshBunkerStats`/`executePhish` in `bunker-logic.js`) pending real DAG-derived state per the architecture doc.

## Game terminology (needed to work on gameplay logic)

Defined in `documentation/gameplay.html`:
- **GWh** — energy cost of one on-chain action (1 GWh per action, drawn from KAS reserves).
- **Cycles** — AI cluster compute capacity; 1 Cycle = 1 unit of work (e.g. one Phish).
- **Sectors** — infrastructure that scales $PUNKW yield.
- **Armageddon Meta** — a global season reset triggered by a successful high-level "hack".

## Visual/UI conventions

Shared look defined in `style.css`: dark terminal aesthetic, monospace (`Courier New`), CSS custom properties `--kaspa-teal`, `--kaspa-bright`, `--bunker-bg`, `--hazard-yellow`. Recurring patterns to reuse rather than reinvent:
- `.btn-execute` / `.btn-danger` for actions.
- `#log.terminal-log` box on every page, updated via an `updateStatus(msg)` helper that appends `> message` lines (duplicated per-page in `bunker-logic.js` and `initialize.js` — keep the same signature if adding it elsewhere).
- ASCII-art logo block (see `asciilogo`) reused verbatim in `index.html`/`bunker.html`.
