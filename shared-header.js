/**
 * CYPHERPUNK_WARS: SHARED_HEADER
 * shared-header.js
 *
 * Renders the ASCII logo + a consistent OPERATOR/network status bar into a
 * mount point present on every page (<div id="app-header"></div>), so the
 * whole app reads as one system instead of independently-styled pages.
 */
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

    const bunkerId = localStorage.getItem("bunker_id");
    const operatorDisplay = bunkerId ? bunkerId.substring(0, 10) + "..." : "UNIDENTIFIED";

    container.innerHTML = `
        <pre class="ascii-logo">${ASCII_LOGO_LINES.join("\n")}</pre>
        <div class="app-status-bar">
            <span>OPERATOR: <span class="app-status-value">${operatorDisplay}</span></span>
            <span class="app-status-value">STATUS: ONLINE // TESTNET-10</span>
        </div>
    `;
}
