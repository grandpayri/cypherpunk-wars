/**
 * CYPHERPUNK_WARS: SHARED_SIDEBAR
 * shared-sidebar.js
 *
 * Persistent left-hand command console: stats block + nav links, with the current page's
 * link highlighted. Mirrors shared-header.js's self-contained pattern -- pages just call
 * renderSidebar(containerId, activePageId) and it handles rendering and its own balance
 * fetching.
 *
 * Must be called AFTER bootBunkerEngine() has resolved -- it calls into kaspa-client.js
 * functions that touch the WASM engine (deriveRestrictedWalletAddress, getAddressBalance).
 *
 * Does NOT redirect if there's no saved identity -- pages that require login (bunker.html,
 * send.html, etc.) already have their own top-level redirect before this ever runs. Pages
 * that don't require login (the docs pages) can still include the sidebar for nav/layout
 * consistency; it just renders a guest state (nav links work, no live balances) instead.
 */
import { getSessionPublicKey } from './wallet-gen.js';
import { getAddressBalance, deriveRestrictedWalletAddress, COST_PER_TURN_SOMPI } from './kaspa-client.js';

const NAV_ITEMS = [
    { id: 'command', label: '[01] COMMAND', href: 'bunker.html' },
    { id: 'attack', label: '[02] ATTACK', href: 'attack.html' },
    { id: 'research', label: '[03] RESEARCH', href: 'research.html' },
    { id: 'rankings', label: '[04] RANKINGS', href: 'leaderboard.html' },
    { id: 'transfer', label: '[05] TRANSFER', href: 'send.html' },
];

const NAV_LINKS_HTML = (activePageId) => NAV_ITEMS.map((item) =>
    `<button class="nav-link${item.id === activePageId ? ' nav-link-active' : ''}" onclick="window.location.href='${item.href}'">> ${item.label}</button>`
).join('\n');

let currentBunkerId = null;

export async function renderSidebar(containerId, activePageId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const bunkerId = localStorage.getItem('bunker_id');
    currentBunkerId = bunkerId;

    if (!bunkerId) {
        container.innerHTML = `
            <div class="stat-label">Status</div>
            <span class="stat-val">NOT_LOGGED_IN</span>

            <hr class="sidebar-divider">

            ${NAV_LINKS_HTML(activePageId)}

            <hr class="sidebar-divider">

            <button class="nav-link" onclick="window.location.href='index.html'">> LOGIN_OR_FORGE</button>
        `;
        return;
    }

    const costPerTurnKas = (Number(COST_PER_TURN_SOMPI) / 1e8).toFixed(3);

    container.innerHTML = `
        <div class="stat-label">Plain Wallet (TKAS)</div>
        <span class="stat-val" id="sidebarPlainBalance">...</span>
        <div class="stat-label">Gameplay Vault (Restricted -- Covenant-Locked)</div>
        <span class="stat-val" id="sidebarVaultBalance">...</span>
        <div class="stat-label">Turns Available (at ~${costPerTurnKas} TKAS/turn)</div>
        <span class="stat-val" id="sidebarTurns">...</span>
        <div class="stat-label">War Chest</div>
        <span class="stat-val">0 $PUNKW</span>
        <div class="stat-label">Infrastructure</div>
        <span class="stat-val">1 SECTOR</span>
        <div class="stat-label">Compute Load</div>
        <span class="stat-val">10/10 CYC</span>

        <hr class="sidebar-divider">

        ${NAV_LINKS_HTML(activePageId)}

        <hr class="sidebar-divider">

        <button class="nav-link" onclick="window.location.href='resume.html'">> SWITCH_ACCOUNT</button>
    `;

    await refreshSidebarStats();
}

export async function refreshSidebarStats() {
    if (!currentBunkerId) return;

    try {
        const balanceSompi = await getAddressBalance(currentBunkerId);
        const plainEl = document.getElementById('sidebarPlainBalance');
        if (plainEl) plainEl.innerText = `${(Number(balanceSompi) / 1e8).toFixed(2)} TKAS`;

        const pubkey = getSessionPublicKey();
        const vaultAddr = deriveRestrictedWalletAddress(pubkey);
        const vaultBalanceSompi = await getAddressBalance(vaultAddr);
        const vaultEl = document.getElementById('sidebarVaultBalance');
        if (vaultEl) vaultEl.innerText = `${(Number(vaultBalanceSompi) / 1e8).toFixed(2)} TKAS`;

        const turnsAvailable = vaultBalanceSompi / COST_PER_TURN_SOMPI; // BigInt division, floors automatically
        const turnsEl = document.getElementById('sidebarTurns');
        if (turnsEl) turnsEl.innerText = turnsAvailable.toString();
    } catch (err) {
        // No session key yet (e.g. page just loaded before boot finished) -- leave
        // placeholders, the calling page's own action handlers redirect to resume.html
        // if this is a real session-key problem.
    }
}
