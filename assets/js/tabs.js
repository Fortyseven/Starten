/**
 * tabs.js — Page tab management.
 */

const Tabs = {
    container: null,

    async init() {
        this.container = document.getElementById('tabs');
        await this.load();

        // Add page button
        document.getElementById('add-page-btn').addEventListener('click', () => this.addPage());
    },

    async load() {
        const result = await api('pages:get');
        if (!result || !result.pages) return;
        AppState.pages = result.pages;
        this.render();

        // Select first page or previously active
        if (AppState.currentPageId === null && result.pages.length > 0) {
            await this.select(result.pages[0].id);
        } else if (AppState.currentPageId !== null) {
            // Restore previously active page
            await this.select(AppState.currentPageId);
        }
    },

    render() {
        this.container.innerHTML = '';
        AppState.pages.forEach(page => {
            const tab = document.createElement('div');
            tab.className = `tab${page.id === AppState.currentPageId ? ' active' : ''}`;
            tab.dataset.id = page.id;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'tab-name';
            nameSpan.textContent = page.name;

            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'tab-delete';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePage(page.id);
            });

            tab.appendChild(nameSpan);
            tab.appendChild(deleteBtn);

            // Click to switch
            tab.addEventListener('click', () => this.select(page.id));

            // Double-click to rename
            nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.renamePageInline(page.id, nameSpan);
            });

            this.container.appendChild(tab);
        });
    },

    async select(pageId) {
        AppState.currentPageId = pageId;
        this.render();
        await Blocks.load();
    },

    async addPage() {
        const name = prompt('Page name:');
        if (!name || name.trim() === '') return;

        const result = await api('pages:add', { name: name.trim() });
        if (result && result.page) {
            await this.load();
            this.select(result.page.id);
        }
    },

    async renamePageInline(pageId, nameEl) {
        const page = AppState.pages.find(p => p.id === pageId);
        if (!page) return;

        nameEl.setAttribute('contenteditable', 'true');
        nameEl.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(nameEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const save = async () => {
            nameEl.removeAttribute('contenteditable');
            const newName = nameEl.textContent.trim();
            if (newName && newName !== page.name) {
                await api('pages:rename', { id: pageId, name: newName });
            }
            this.render();
        };

        nameEl.addEventListener('blur', save, { once: true });
        nameEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameEl.blur();
            }
            if (e.key === 'Escape') {
                nameEl.textContent = page.name;
                nameEl.blur();
            }
        });
    },

    async deletePage(pageId) {
        const page = AppState.pages.find(p => p.id === pageId);
        if (!page) return;
        if (!confirm(`Delete page "${page.name}" and all its blocks?`)) return;

        await api('pages:delete', { id: pageId });
        await this.load();

        // Switch to another page if needed
        if (AppState.currentPageId === pageId) {
            const next = AppState.pages[0] || null;
            if (next) {
                this.select(next.id);
            } else {
                AppState.currentPageId = null;
                Blocks.render([]);
            }
        }
    },
};
