/**
 * layout.js — Layout column management.
 *
 * Handles layout mode switching (auto vs fixed columns),
 * applies CSS Grid/masonry classes, and persists to the database.
 */

const Layout = {
    STORAGE_KEY: 'startpage-layout-ui',

    /**
     * Initialize layout module.
     */
    init() {
        // Apply saved layout from localStorage (UI state)
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            this.apply(saved);
        }
    },

    /**
     * Apply layout mode to the page.
     * @param {string} columns - 'auto' or '1'-'5'
     */
    apply(columns) {
        const container = document.getElementById('blocks-container');
        if (!container) return;

        container.dataset.layout = columns;

        // Update layout selector buttons
        document.querySelectorAll('.layout-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.columns === columns);
        });
    },

    /**
     * Get current layout columns.
     * @returns {string} Current layout value
     */
    get() {
        const container = document.getElementById('blocks-container');
        return container ? container.dataset.layout : 'auto';
    },

    /**
     * Save layout to localStorage and apply.
     * @param {string} columns - 'auto' or '1'-'5'
     */
    set(columns) {
        localStorage.setItem(this.STORAGE_KEY, columns);
        this.apply(columns);
    },

    /**
     * Save layout to the database for the current page.
     * @param {string} columns - 'auto' or '1'-'5'
     * @returns {Promise<boolean>} Success status
     */
    async saveToDatabase(columns) {
        if (!AppState.currentPageId) return false;

        // Reassign blocks if they exceed the new column count
        const colNum = columns === 'auto' ? 0 : parseInt(columns, 10);
        if (colNum > 0) {
            this.reassignBlocks(colNum);
        }

        const result = await api('pages:update', {
            id: AppState.currentPageId,
            layout: { columns: columns },
        });

        if (result && result.page) {
            // Update AppState
            const pageIndex = AppState.pages.findIndex(p => p.id === AppState.currentPageId);
            if (pageIndex !== -1) {
                AppState.pages[pageIndex].layout = result.page.layout;
            }
            this.set(columns);
            return true;
        }
        return false;
    },

    /**
     * Reassign blocks that exceed the new column count, and distribute them across columns.
     * @param {number} maxColumns - New maximum column count
     */
    reassignBlocks(maxColumns) {
        // First, ensure no block exceeds the max column
        AppState.blocks.forEach(block => {
            const config = typeof block.config === 'string' ? JSON.parse(block.config) : (block.config || {});
            const col = config.column || 1;
            if (col > maxColumns) {
                config.column = maxColumns;
                block.config = config;
            }
        });

        // Then distribute blocks evenly across columns
        AppState.blocks.forEach((block, index) => {
            const config = typeof block.config === 'string' ? JSON.parse(block.config) : (block.config || {});
            config.column = (index % maxColumns) + 1;
            block.config = config;
            // Update in database
            api('blocks:update', { id: block.id, config: config }).catch(err => {
                console.error('Failed to reassign block column:', err);
            });
        });
    },
};
