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

let currentBunkerId = null;

export async function renderSidebar(containerId, activePageId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const bunkerId = localStorage.getItem('bunker_id');
    if (!bunkerId) {
        window.location.href = 'index.html';
        return;
    }
    currentBunkerId = bunkerId;

    const costPerTurnKas = (Number(COST_PER_TURN_SOMPI) / 1e8).toFixed(3);

    container.innerHTML = `
        <div class="stat-label">Full Address</div>
        <div class="sidebar-address">${bunkerId}</div>

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

        ${NAV_ITEMS.map((item) => `<button class="nav-link${item.id === activePageId ? ' nav-link-active' : ''}" onclick="window.location.href='${item.href}'">> ${item.label}</button>`).join('\n')}

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
