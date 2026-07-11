// esbuild --inject shim: some bundled Node-originated dependencies (e.g.
// circomlibjs -> blake-hash) reference the Node globals `Buffer`/`process`
// as bare identifiers at runtime, not just at import time -- installing the
// `buffer`/`process` npm packages only satisfies esbuild's *import*
// resolution (see bundle-poseidon-entry.js), not the runtime global lookup.
// This file is injected via `--inject=node-globals-shim.js`, which makes
// esbuild rewrite bare `Buffer`/`process` references to these bindings.
import { Buffer as BufferPolyfill } from "buffer";
import processPolyfill from "process/browser.js";
export const Buffer = BufferPolyfill;
export const process = processPolyfill;
