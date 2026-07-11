#!/usr/bin/env node
// Demo round-trip: commit to a seed, generate a witness + Groth16 proof,
// verify it locally, then confirm a tampered public output is rejected.
// Zero chain involvement -- see ../README.md.
//
// Usage: node scripts/prove.js [seed] [sectors] [nodeSpec]
//   seed     in [0, 39], default 17
//   sectors  in [0, 200), default 5
//   nodeSpec 0-5 (NodeSpecialization enum, kaspa-client.js), default 2 (Infrastructure)

const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { buildPoseidon } = require("circomlibjs");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const SNARKJS_CLI = path.join(ROOT, "node_modules", "snarkjs", "build", "cli.cjs");

const NODE_SPEC_INFRASTRUCTURE = 2;
const SECTOR_YIELD_BONUS = 2;
const NODE_SPEC_INFRA_BONUS = 15;

function run(cmd, args) {
  console.log(`$ ${path.basename(cmd)} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", cwd: ROOT });
}

// See scripts/setup.js for why this goes through `node <cli.cjs>` instead
// of the node_modules/.bin shim (Windows EINVAL on the .cmd wrapper).
function snarkjs(args) {
  run(process.execPath, [SNARKJS_CLI, ...args]);
}

async function main() {
  const seed = BigInt(process.argv[2] ?? "17");
  const sectors = BigInt(process.argv[3] ?? "5");
  const nodeSpec = BigInt(process.argv[4] ?? String(NODE_SPEC_INFRASTRUCTURE));
  if (seed < 0n || seed > 39n) throw new Error("seed must be in [0, 39]");
  if (sectors < 0n || sectors >= 200n) throw new Error("sectors must be in [0, 200)");
  if (nodeSpec < 0n || nodeSpec > 5n) throw new Error("nodeSpec must be in [0, 5]");

  const zkeyPath = path.join(BUILD, "phishYield_final.zkey");
  if (!fs.existsSync(zkeyPath)) {
    console.error(`${zkeyPath} not found -- run \`node scripts/setup.js\` first.`);
    process.exit(1);
  }

  const poseidon = await buildPoseidon();
  const commitment = poseidon.F.toObject(poseidon([seed]));

  fs.writeFileSync(
    path.join(BUILD, "input.json"),
    JSON.stringify(
      { seed: seed.toString(), commitment: commitment.toString(), sectors: sectors.toString(), nodeSpec: nodeSpec.toString() },
      null,
      2
    )
  );

  run(process.execPath, [
    path.join("build", "phishYield_js", "generate_witness.js"),
    path.join("build", "phishYield_js", "phishYield.wasm"),
    path.join("build", "input.json"),
    path.join("build", "witness.wtns"),
  ]);

  snarkjs([
    "groth16",
    "prove",
    "build/phishYield_final.zkey",
    "build/witness.wtns",
    "build/proof.json",
    "build/public.json",
  ]);

  const publicSignals = JSON.parse(fs.readFileSync(path.join(BUILD, "public.json")));
  const baseRoll = 10n + seed;
  const sectorBonus = sectors * BigInt(SECTOR_YIELD_BONUS);
  const specBonus = nodeSpec === BigInt(NODE_SPEC_INFRASTRUCTURE) ? BigInt(NODE_SPEC_INFRA_BONUS) : 0n;
  const expected = baseRoll + sectorBonus + specBonus;
  console.log(
    `\nProven yieldAmount = ${publicSignals[0]} ` +
      `(baseRoll ${baseRoll} + sectorBonus ${sectorBonus} [${sectors} sectors] + specBonus ${specBonus} [nodeSpec ${nodeSpec}] = ${expected})`
  );
  if (publicSignals[0] !== expected.toString()) {
    throw new Error(`Circuit output ${publicSignals[0]} doesn't match expected ${expected} -- formula mismatch between circuit and script.`);
  }

  console.log("\n--- verifying the real proof (expect OK) ---");
  snarkjs([
    "groth16",
    "verify",
    "build/verification_key.json",
    "build/public.json",
    "build/proof.json",
  ]);

  console.log("\n--- verifying a tampered claim (expect rejection) ---");
  const tampered = [...publicSignals];
  tampered[0] = String(BigInt(publicSignals[0]) + 1n);
  fs.writeFileSync(path.join(BUILD, "public_tampered.json"), JSON.stringify(tampered));
  try {
    snarkjs([
      "groth16",
      "verify",
      "build/verification_key.json",
      "build/public_tampered.json",
      "build/proof.json",
    ]);
    console.error("\nUNEXPECTED: tampered claim verified successfully -- something is wrong.");
    process.exit(1);
  } catch {
    console.log("\nTampered claim correctly rejected. Round-trip confirmed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
