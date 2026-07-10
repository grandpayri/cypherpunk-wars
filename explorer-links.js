/**
 * CYPHERPUNK_WARS: EXPLORER_LINKS
 * explorer-links.js
 *
 * Every address/txid displayed anywhere in the UI should link out to a real block
 * explorer instead of being inert text -- these are the two helpers everything else
 * routes through, so the target explorer only needs to change in one place.
 * testnet-10 only (kaspa.stream's TN10 subdomain), matching kaspa-client.js's
 * CPW_NETWORK_ID -- update EXPLORER_BASE if the network this game runs on ever changes.
 */
const EXPLORER_BASE = "https://tn10.kaspa.stream";

// Not encodeURIComponent(address): a Kaspa address's only "special" character is its
// `:` prefix separator, which real kaspa.stream links use raw/unencoded (confirmed
// against a live example URL) -- percent-encoding it to %3A risks the site's
// client-side router not matching the route correctly, for no benefit (":" is already a
// valid literal character in a URL path segment per RFC 3986).
export function explorerAddressUrl(address) {
    return `${EXPLORER_BASE}/addresses/${address}`;
}

export function explorerTxUrl(txid) {
    return `${EXPLORER_BASE}/transactions/${txid}`;
}

// Wraps a displayed address/txid string in a real link, opening in a new tab so the
// player never loses their place in the app. `displayText` lets callers keep truncating
// for space while the link itself still points at the full value.
export function addressLinkHtml(address, displayText = address) {
    return `<a href="${explorerAddressUrl(address)}" target="_blank" rel="noopener" class="explorer-link">${displayText}</a>`;
}

export function txLinkHtml(txid, displayText = txid) {
    return `<a href="${explorerTxUrl(txid)}" target="_blank" rel="noopener" class="explorer-link">${displayText}</a>`;
}
