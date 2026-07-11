// Converts a snarkjs Groth16 proof/verifying-key/public-signals triple into
// the exact byte encoding rusty-kaspa's OpZkPrecompile (KIP-16, Groth16
// verifier tag 0x20) expects: Arkworks (ark-bn254/ark-groth16/ark-serialize,
// pinned to the same 0.6.0 rusty-kaspa uses) compressed serialization.
//
// Before trusting the output bytes, this also re-verifies the parsed proof
// with ark-groth16's own verify_proof -- the same crate Kaspa's verifier
// uses -- as an independent check that the snarkjs -> arkworks point
// mapping (in particular G2 coordinate order, a known gotcha between
// ecosystems) was done correctly, not just re-trusting snarkjs's own
// verifier.
//
// This crate builds two ways:
//   - as a native binary (src/main.rs) for local testing against files in
//     ../build/, fast iteration without a browser
//   - as a wasm-bindgen library (this file's `convert` export, built via
//     `wasm-pack build --target web`) for in-browser use by the live game,
//     which cannot shell out to a Rust CLI

use ark_bn254::{Bn254, Fq, Fq2, Fr, G1Affine, G2Affine};
use ark_groth16::{Groth16, PreparedVerifyingKey, Proof, VerifyingKey};
use ark_serialize::CanonicalSerialize;
use ark_snark::SNARK;
use serde::Serialize;
use serde_json::Value;
use std::str::FromStr;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
pub struct ConversionResult {
    pub swap_g2: bool,
    pub proof_hex: String,
    pub verification_key_hex: String,
    pub public_input_hexes: Vec<String>,
}

fn parse_fq(s: &str) -> Result<Fq, String> {
    Fq::from_str(s).map_err(|_| format!("invalid field element: {s}"))
}

fn parse_fr(s: &str) -> Result<Fr, String> {
    Fr::from_str(s).map_err(|_| format!("invalid field element: {s}"))
}

fn parse_g1(v: &Value) -> Result<G1Affine, String> {
    let arr = v.as_array().ok_or("expected array for G1 point")?;
    let x = parse_fq(arr[0].as_str().ok_or("expected string")?)?;
    let y = parse_fq(arr[1].as_str().ok_or("expected string")?)?;
    Ok(G1Affine::new_unchecked(x, y))
}

// snarkjs serializes a G2 point's Fq2 coordinates as [c0, c1] (value =
// c0 + c1*u), same convention ark-bn254's Fq2::new(c0, c1) expects -- but
// this is exactly the kind of ecosystem gotcha that must be confirmed by
// actually re-verifying the proof, not assumed. `swap` lets convert() try
// both orderings.
fn parse_g2(v: &Value, swap: bool) -> Result<G2Affine, String> {
    let arr = v.as_array().ok_or("expected array for G2 point")?;
    let xs = arr[0].as_array().ok_or("expected array")?;
    let ys = arr[1].as_array().ok_or("expected array")?;
    let (x0, x1) = (
        xs[0].as_str().ok_or("expected string")?,
        xs[1].as_str().ok_or("expected string")?,
    );
    let (y0, y1) = (
        ys[0].as_str().ok_or("expected string")?,
        ys[1].as_str().ok_or("expected string")?,
    );
    let x = if swap {
        Fq2::new(parse_fq(x1)?, parse_fq(x0)?)
    } else {
        Fq2::new(parse_fq(x0)?, parse_fq(x1)?)
    };
    let y = if swap {
        Fq2::new(parse_fq(y1)?, parse_fq(y0)?)
    } else {
        Fq2::new(parse_fq(y0)?, parse_fq(y1)?)
    };
    Ok(G2Affine::new_unchecked(x, y))
}

fn build_proof(proof_json: &Value, swap_g2: bool) -> Result<Proof<Bn254>, String> {
    Ok(Proof {
        a: parse_g1(&proof_json["pi_a"])?,
        b: parse_g2(&proof_json["pi_b"], swap_g2)?,
        c: parse_g1(&proof_json["pi_c"])?,
    })
}

fn build_vk(vk_json: &Value, swap_g2: bool) -> Result<VerifyingKey<Bn254>, String> {
    let ic = vk_json["IC"].as_array().ok_or("expected IC array")?;
    Ok(VerifyingKey {
        alpha_g1: parse_g1(&vk_json["vk_alpha_1"])?,
        beta_g2: parse_g2(&vk_json["vk_beta_2"], swap_g2)?,
        gamma_g2: parse_g2(&vk_json["vk_gamma_2"], swap_g2)?,
        delta_g2: parse_g2(&vk_json["vk_delta_2"], swap_g2)?,
        gamma_abc_g1: ic.iter().map(parse_g1).collect::<Result<Vec<_>, _>>()?,
    })
}

fn compressed_hex<T: CanonicalSerialize>(item: &T) -> String {
    let mut buf = Vec::new();
    item.serialize_compressed(&mut buf).expect("serialize");
    hex::encode(buf)
}

/// Pure-Rust core, no wasm types -- testable natively (see src/main.rs) and
/// reused by the wasm export below.
pub fn convert_core(
    proof_json_str: &str,
    vk_json_str: &str,
    public_json_str: &str,
) -> Result<ConversionResult, String> {
    let proof_json: Value =
        serde_json::from_str(proof_json_str).map_err(|e| format!("bad proof JSON: {e}"))?;
    let vk_json: Value =
        serde_json::from_str(vk_json_str).map_err(|e| format!("bad verification key JSON: {e}"))?;
    let public_json: Value =
        serde_json::from_str(public_json_str).map_err(|e| format!("bad public signals JSON: {e}"))?;

    let public_inputs: Vec<Fr> = public_json
        .as_array()
        .ok_or("expected public signals array")?
        .iter()
        .map(|v| parse_fr(v.as_str().ok_or("expected string")?))
        .collect::<Result<Vec<_>, _>>()?;

    let mut working_swap = None;
    for swap in [false, true] {
        let proof = build_proof(&proof_json, swap)?;
        let vk = build_vk(&vk_json, swap)?;
        let pvk: PreparedVerifyingKey<Bn254> = Groth16::<Bn254>::process_vk(&vk)
            .map_err(|e| format!("process_vk failed: {e}"))?;
        let ok = Groth16::<Bn254>::verify_with_processed_vk(&pvk, &public_inputs, &proof)
            .unwrap_or(false);
        if ok {
            working_swap = Some(swap);
            break;
        }
    }

    let swap = working_swap.ok_or(
        "Neither G2 coordinate ordering verified with ark-groth16's own verify_proof -- \
         refusing to return unverified bytes."
            .to_string(),
    )?;

    let proof = build_proof(&proof_json, swap)?;
    let vk = build_vk(&vk_json, swap)?;

    Ok(ConversionResult {
        swap_g2: swap,
        proof_hex: compressed_hex(&proof),
        verification_key_hex: compressed_hex(&vk),
        public_input_hexes: public_inputs.iter().map(compressed_hex).collect(),
    })
}

/// Browser entry point. Takes the same three JSON strings snarkjs produces
/// (proof.json, verification_key.json, public.json contents) and returns a
/// JSON string of ConversionResult. Errors surface as a rejected JS
/// exception (via JsValue) rather than silently returning unverified bytes
/// -- see convert_core's refusal above.
#[wasm_bindgen]
pub fn convert(proof_json: &str, vk_json: &str, public_json: &str) -> Result<String, JsValue> {
    let result = convert_core(proof_json, vk_json, public_json).map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&result).map_err(|e| JsValue::from_str(&format!("serialize failed: {e}")))
}
