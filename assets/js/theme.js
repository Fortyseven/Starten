/**
 * theme.js — Theme toggle and persistence.
 */

const Theme = {
    STORAGE_KEY: 'startpage-theme',

    init() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        const theme = saved || 'light';
        this.set(theme);

        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme');
                const next = current === 'dark' ? 'light' : 'dark';
                this.set(next);
            });
        }
    },

    set(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this.STORAGE_KEY, theme);
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        this.set(current === 'dark' ? 'light' : 'dark');
    },
};
