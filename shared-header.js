/**
 * CYPHERPUNK_WARS: SHARED_HEADER
 * shared-header.js
 *
 * Renders the ASCII logo + a consistent OPERATOR/network status bar into a
 * mount point present on every page (<div id="app-header"></div>), so the
 * whole app reads as one system instead of independently-styled pages.
 */
import { addressLinkHtml, explorerAddressUrl } from './explorer-links.js';
import { bootBunkerEngine } from './wallet-gen.js';
import { getAddressBalance, PRIZE_VAULT_ADDRESS } from './kaspa-client.js';

const ASCII_LOGO_LINES = [
    "    ____            _               _____             _     __          __            ",
    "  / ____|          | |             |  __ \\           | |    \\ \\        / /            ",
    " | |    _   _ _ __ | |__   ___ _ __| |__) |   _ _ __ | | __  \\ \\  /\\  / /_ _ _ __ ___ ",
    " | |   | | | | '_ \\| '_ \\ / _ \\ '__|  ___/ | | | '_ \\| |/ /   \\ \\/  \\/ / _` | '__/ __|",
    " | |___| |_| | |_) | | | |  __/ |  | |   | |_| | | | |   <     \\  /\\  / (_| | |  \\__ \\",
    "  \\_____\\__, | .__/|_| |_|\\___|_|  |_|    \\__,_|_| |_|_|\\_\\     \\/  \\/ \\__,_|_|  |___/",
    "         __/ | |                                                                      ",
    "        |___/|_|                                                                      ",
];

export function renderAppHeader(containerId = "app-header") {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Never truncate an address -- a truncated string is neither a friendly name nor a
    // fully usable/verifiable/copyable identifier, so it's worse than either alternative.
    // Show the complete address until a real name (e.g. KNS) resolves to replace it. The
    // copy button is what makes "full, untruncated" actually convenient to use.
    const bunkerId = localStorage.getItem("bunker_id");
    const operatorDisplay = bunkerId ? addressLinkHtml(bunkerId) : "UNIDENTIFIED";
    const copyButton = bunkerId
        ? `<button class="copy-btn" onclick="window.copyOperatorAddress(this)">[COPY]</button>`
        : "";

    container.innerHTML = `
        <pre class="ascii-logo">${ASCII_LOGO_LINES.join("\n")}</pre>
        <a href="${explorerAddressUrl(PRIZE_VAULT_ADDRESS)}" target="_blank" rel="noopener" class="prize-vault-banner" title="View the Prize Vault on the block explorer">
            <span class="prize-vault-label">[ This Season's Prize Vault ]</span>
            <span class="prize-vault-value" id="prizeVaultValue">SYNCING...</span>
        </a>
        <div class="app-status-bar">
            <span>OPERATOR: <span class="app-status-value">${operatorDisplay}</span>${copyButton}</span>
            <span class="app-status-value">STATUS: ONLINE // TESTNET-10</span>
        </div>
    `;

    refreshPrizeVaultValue();
}

// Self-contained on purpose -- shared-header.js renders on every page, including ones
// that don't otherwise boot the WASM engine at all (e.g. index.html). bootBunkerEngine()
// is idempotent/dedupes concurrent calls (see wallet-gen.js), so this is safe to fire
// alongside whatever boot call a page's own script also makes.
async function refreshPrizeVaultValue() {
    const el = document.getElementById("prizeVaultValue");
    if (!el) return;
    try {
        const ready = await bootBunkerEngine();
        if (!ready) throw new Error("ENGINE_OFFLINE");
        const balanceSompi = await getAddressBalance(PRIZE_VAULT_ADDRESS);
        el.innerText = `${(Number(balanceSompi) / 1e8).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TKAS`;
    } catch (err) {
        console.error("PRIZE_VAULT_FETCH_ERROR:", err);
        el.innerText = "OFFLINE";
    }
}

window.copyOperatorAddress = function (button) {
    const bunkerId = localStorage.getItem("bunker_id");
    if (!bunkerId) return;
    const original = button.innerText;
    navigator.clipboard.writeText(bunkerId).then(() => {
        button.innerText = "[COPIED]";
        setTimeout(() => { button.innerText = original; }, 1500);
    }).catch((err) => {
        console.error("CLIPBOARD_COPY_ERROR:", err);
        button.innerText = "[COPY_FAILED]";
        setTimeout(() => { button.innerText = original; }, 1500);
    });
};
