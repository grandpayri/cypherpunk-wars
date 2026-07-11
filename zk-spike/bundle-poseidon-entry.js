// One-time bundling entry point -- see README.md's "Static assets" section.
// Not shipped itself; esbuild bundles this + circomlibjs/ffjavascript into
// a single static file (zk/poseidon.esm.js) so the browser doesn't need to
// resolve circomlibjs's bare "ffjavascript" import specifier.
export { buildPoseidon } from "circomlibjs";
