#!/usr/bin/env node
// Compiles circuits/phishYield.circom and runs a local Groth16 trusted
// setup (Powers of Tau + circuit-specific zkey). Regenerates everything
// under build/, which is gitignored -- see ../README.md for why the
// setup output isn't committed.
//
// Usage: node scripts/setup.js
// Requires bin/circom.exe on disk first -- see README.md "Getting circom".

const { execFileSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const CIRCOM = process.env.CIRCOM_BIN || path.join(ROOT, "bin", "circom.exe");
const SNARKJS_CLI = path.join(ROOT, "node_modules", "snarkjs", "build", "cli.cjs");

function run(cmd, args) {
  console.log(`$ ${path.basename(cmd)} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", cwd: ROOT });
}

// Invoke snarkjs via `node <cli.cjs>` rather than the node_modules/.bin
// shim -- on Windows, execFileSync-ing the .cmd shim directly fails with
// EINVAL. Going through node avoids the platform-specific wrapper entirely.
function snarkjs(args) {
  run(process.execPath, [SNARKJS_CLI, ...args]);
}

function entropy() {
  return crypto.randomBytes(32).toString("hex");
}

function main() {
  if (!fs.existsSync(CIRCOM)) {
    console.error(`circom binary not found at ${CIRCOM}`);
    console.error("See README.md's \"Getting circom\" section.");
    process.exit(1);
  }

  fs.mkdirSync(BUILD, { recursive: true });

  run(CIRCOM, [
    "circuits/phishYield.circom",
    "--r1cs",
    "--wasm",
    "--sym",
    "-o",
    "build",
  ]);

  // Local, single-contributor Powers of Tau -- fine for this spike, but
  // NOT a public ceremony. Do not reuse this ptau/zkey for anything that
  // ends up live on-chain; swap in a publicly-audited ceremony (e.g. the
  // Hermez "powersOfTau28_hez_final" series) before that happens.
  snarkjs([
    "powersoftau",
    "new",
    "bn128",
    "12",
    "build/pot12_0000.ptau",
    "-v",
  ]);
  snarkjs([
    "powersoftau",
    "contribute",
    "build/pot12_0000.ptau",
    "build/pot12_0001.ptau",
    "--name=local spike contribution",
    "-v",
    `-e=${entropy()}`,
  ]);
  snarkjs([
    "powersoftau",
    "prepare",
    "phase2",
    "build/pot12_0001.ptau",
    "build/pot12_final.ptau",
    "-v",
  ]);

  snarkjs([
    "groth16",
    "setup",
    "build/phishYield.r1cs",
    "build/pot12_final.ptau",
    "build/phishYield_0000.zkey",
  ]);
  snarkjs([
    "zkey",
    "contribute",
    "build/phishYield_0000.zkey",
    "build/phishYield_final.zkey",
    "--name=local spike zkey contribution",
    "-v",
    `-e=${entropy()}`,
  ]);
  snarkjs([
    "zkey",
    "export",
    "verificationkey",
    "build/phishYield_final.zkey",
    "build/verification_key.json",
  ]);

  console.log(
    "\nDone. build/phishYield_final.zkey (proving key) and " +
      "build/verification_key.json (verifying key) are ready.\n" +
      "Run `node scripts/prove.js [seed]` next."
  );
}

main();
