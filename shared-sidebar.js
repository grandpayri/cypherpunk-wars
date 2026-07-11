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
 * functions that touch the WASM engine (deriveZkPhishAddress, getAddressBalance).
 *
 * Does NOT redirect if there's no saved identity -- pages that require login (bunker.html,
 * send.html, etc.) already have their own top-level redirect before this ever runs. Pages
 * that don't require login (the docs pages) can still include the sidebar for nav/layout
 * consistency; it just renders a guest state (nav links work, no live balances) instead.
 */
import { getSessionPublicKey } from './wallet-gen.js';
import { getAddressBalance, deriveZkPhishAddress, COST_PER_TURN_SOMPI } from './kaspa-client.js';

// Attack and Research used to be their own persistent nav destinations (separate
// COMING_SOON pages) -- they're now options inside the Command Center's action grid
// instead (bunker.html), so they've come off this list. attack.html/research.html still
// exist as unlinked placeholders for whenever those systems are actually built.
const NAV_ITEMS = [
    { id: 'wallet', label: '[01] WALLET_MANAGEMENT', href: 'send.html' },
    { id: 'command', label: '[02] COMMAND', href: 'bunker.html' },
    { id: 'rankings', label: '[03] RANKINGS', href: 'leaderboard.html' },
    { id: 'history', label: '[04] CPW_HISTORY', href: 'history.html' },
];

const NAV_LINKS_HTML = (activePageId) => NAV_ITEMS.map((item) =>
    `<button class="nav-link${item.id === activePageId ? ' nav-link-active' : ''}" onclick="window.location.href='${item.href}'">> ${item.label}</button>`
).join('\n');

let currentBunkerId = null;

// $PUNKW and turnCount aren't derived from the chain yet (no indexer -- see Phase 5), so
// these are local caches per identity, kept in sync with the state-snapshot written into
// every Genesis/Phish payload (see kaspa-client.js's encodeGameStateSnapshot). Same trust
// model already established for Phish yield: client-computed and displayed today, not yet
// chain-verified.
function punkwStorageKey(bunkerId) {
    return `punkw_balance_${bunkerId}`;
}

export function getPunkwBalance(bunkerId) {
    const raw = localStorage.getItem(punkwStorageKey(bunkerId));
    return raw ? parseInt(raw, 10) : 0;
}

export function setPunkwBalance(bunkerId, value) {
    localStorage.setItem(punkwStorageKey(bunkerId), String(value));
}

function turnCountStorageKey(bunkerId) {
    return `turn_count_${bunkerId}`;
}

export function getTurnCount(bunkerId) {
    const raw = localStorage.getItem(turnCountStorageKey(bunkerId));
    return raw ? parseInt(raw, 10) : 0;
}

export function setTurnCount(bunkerId, value) {
    localStorage.setItem(turnCountStorageKey(bunkerId), String(value));
}

// Sectors are now a real, buildable mechanic (Phase 6) -- same local-cache-kept-in-sync-
// with-the-on-chain-payload pattern as punkw/turnCount above, starting at 0 (no player has
// built one yet) rather than the old fixed "1 SECTOR" sidebar placeholder.
function sectorCountStorageKey(bunkerId) {
    return `sector_count_${bunkerId}`;
}

export function getSectorCount(bunkerId) {
    const raw = localStorage.getItem(sectorCountStorageKey(bunkerId));
    return raw ? parseInt(raw, 10) : 0;
}

export function setSectorCount(bunkerId, value) {
    localStorage.setItem(sectorCountStorageKey(bunkerId), String(value));
}

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
        <span class="stat-val" id="sidebarPunkw">${getPunkwBalance(bunkerId)} $PUNKW</span>
        <div class="stat-label">Infrastructure</div>
        <span class="stat-val" id="sidebarSectors">${getSectorCount(bunkerId)} SECTOR${getSectorCount(bunkerId) === 1 ? '' : 'S'}</span>

        <hr class="sidebar-divider">

        ${NAV_LINKS_HTML(activePageId)}

        <hr class="sidebar-divider">

        <button class="nav-link" onclick="window.location.href='resume.html'">> SWITCH_ACCOUNT</button>
    `;

    await refreshSidebarStats();
}

export async function refreshSidebarStats() {
    if (!currentBunkerId) return;

    const punkwEl = document.getElementById('sidebarPunkw');
    if (punkwEl) punkwEl.innerText = `${getPunkwBalance(currentBunkerId)} $PUNKW`;

    const sectorsEl = document.getElementById('sidebarSectors');
    if (sectorsEl) {
        const sectorCount = getSectorCount(currentBunkerId);
        sectorsEl.innerText = `${sectorCount} SECTOR${sectorCount === 1 ? '' : 'S'}`;
    }

    try {
        const balanceSompi = await getAddressBalance(currentBunkerId);
        const plainEl = document.getElementById('sidebarPlainBalance');
        if (plainEl) plainEl.innerText = `${(Number(balanceSompi) / 1e8).toFixed(2)} TKAS`;

        const pubkey = getSessionPublicKey();
        const vaultAddr = deriveZkPhishAddress(pubkey);
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
