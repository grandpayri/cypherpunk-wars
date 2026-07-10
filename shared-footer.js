/**
 * CYPHERPUNK_WARS: SHARED_FOOTER
 * shared-footer.js
 *
 * Doc links row (GAMEPLAY/ARCHITECTURE/WHITEPAPER), shared across every page the same way
 * shared-header.js/shared-sidebar.js are -- mount a <div id="docs-footer" class="docs-footer">
 * and call renderFooter(containerId, activePageId). activePageId is optional: docs pages
 * pass their own id so their own link highlights; every other page omits it.
 */
const FOOTER_ITEMS = [
    { id: 'gameplay', label: '[DOCS] GAMEPLAY', href: 'gameplay.html' },
    { id: 'architecture', label: '[DOCS] ARCHITECTURE', href: 'architecture.html' },
    { id: 'whitepaper', label: '[DOCS] WHITEPAPER', href: 'whitepaper.html' },
];

export function renderFooter(containerId = 'docs-footer', activePageId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = FOOTER_ITEMS.map((item) =>
        `<button class="nav-link${item.id === activePageId ? ' nav-link-active' : ''}" onclick="window.location.href='${item.href}'">${item.label}</button>`
    ).join('\n');
}
