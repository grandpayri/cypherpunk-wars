/**
 * CYPHERPUNK_WARS: SHARED_HEADER
 * shared-header.js
 *
 * Renders the ASCII logo + a consistent OPERATOR/network status bar into a
 * mount point present on every page (<div id="app-header"></div>), so the
 * whole app reads as one system instead of independently-styled pages.
 */
import { addressLinkHtml } from './explorer-links.js';

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
        <div class="app-status-bar">
            <span>OPERATOR: <span class="app-status-value">${operatorDisplay}</span>${copyButton}</span>
            <span class="app-status-value">STATUS: ONLINE // TESTNET-10</span>
        </div>
    `;
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
