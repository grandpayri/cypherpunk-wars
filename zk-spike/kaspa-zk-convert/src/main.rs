// Thin CLI wrapper around lib.rs's convert_core -- reads
// ../build/{proof,verification_key,public}.json (or ../build-prod/ if
// present), writes ../build/onchain_encoding.json, same behavior as
// before this crate became a library. See lib.rs for the actual logic and
// why it also builds as a wasm-bindgen module.

use kaspa_zk_convert::convert_core;
use std::fs;

fn main() {
    let build_dir = "../build";
    let proof_json_str = fs::read_to_string(format!("{build_dir}/proof.json")).unwrap();
    let vk_json_str = fs::read_to_string(format!("{build_dir}/verification_key.json")).unwrap();
    let public_json_str = fs::read_to_string(format!("{build_dir}/public.json")).unwrap();

    let result = match convert_core(&proof_json_str, &vk_json_str, &public_json_str) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    };

    println!("swap_g2={}", result.swap_g2);
    println!(
        "\nproof (compressed, hex, {} bytes):",
        result.proof_hex.len() / 2
    );
    println!("{}\n", result.proof_hex);
    println!(
        "verifying key (compressed, hex, {} bytes):",
        result.verification_key_hex.len() / 2
    );
    println!("{}\n", result.verification_key_hex);
    println!(
        "public inputs ({} items, 32 bytes each):",
        result.public_input_hexes.len()
    );
    for (i, h) in result.public_input_hexes.iter().enumerate() {
        println!("  [{i}] {h}");
    }

    fs::write(
        format!("{build_dir}/onchain_encoding.json"),
        serde_json::to_string_pretty(&result).unwrap(),
    )
    .unwrap();
    println!("\nWrote {build_dir}/onchain_encoding.json");
}
