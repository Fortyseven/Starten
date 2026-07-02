/**
 * app.js — Main entry, API helper, module bootstrap.
 */

// Shared state
const AppState = {
    currentPageId: null,
    pages: [],
    blocks: [],
    editModeBlockId: null,
};

/**
 * API helper — POST JSON to index.php?action=...
 */
async function api(action, data = {}) {
    const url = `index.php?action=${encodeURIComponent(action)}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }));
            console.error(`API error [${action}]:`, err);
            return null;
        }
        return response.json();
    } catch (e) {
        console.error(`API request failed [${action}]:`, e);
        return null;
    }
}

/**
 * Debounce helper
 */
function debounce(fn, ms = 150) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

/**
 * Extract domain from URL for favicon
 */
function extractDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname;
    } catch {
        return '';
    }
}

/**
 * Get favicon URL using Google S2
 */
function faviconUrl(url) {
    const domain = extractDomain(url);
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme first
    Theme.init();

    // Then load tabs and blocks
    Tabs.init();
});
