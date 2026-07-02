/**
 * items.js — Item (link) editing, drag-and-drop (reorder/move items).
 *
 * Shared utilities used by LinkListBlock and other item-based blocks.
 * Container-level drag-and-drop is now handled by each block class.
 */

const Items = {
    itemTemplate: null,
    addFormTemplate: null,
    dragState: null,

    init() {
        this.itemTemplate = document.getElementById('item-template');
        this.addFormTemplate = document.getElementById('add-item-form');
    },

    /**
     * Show the add-item form inside a block.
     * @param {HTMLElement} blockEl - The .block element
     * @param {number} blockId - Block ID
     */
    showAddForm(blockEl, blockId) {
        // Remove any existing add forms in this block
        blockEl.querySelectorAll('.add-item-form').forEach(f => f.remove());

        const clone = this.addFormTemplate.content.cloneNode(true);
        const form = clone.querySelector('.add-item-form');
        const urlInput = form.querySelector('.item-url-input');
        const titleInput = form.querySelector('.item-title-input');
        const saveBtn = form.querySelector('.save-item-btn');
        const cancelBtn = form.querySelector('.cancel-item-btn');

        const itemsContainer = blockEl.querySelector('.block-items');
        itemsContainer.appendChild(form);
        urlInput.focus();

        const save = async () => {
            const url = urlInput.value.trim();
            if (!url) {
                urlInput.focus();
                return;
            }

            const title = titleInput.value.trim();
            await api('items:add', { block_id: blockId, url, title });
            await Blocks.load();
        };

        saveBtn.addEventListener('click', save);
        cancelBtn.addEventListener('click', () => form.remove());

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (titleInput.value.trim() === '') {
                    titleInput.focus();
                } else {
                    save();
                }
            }
            if (e.key === 'Escape') {
                form.remove();
            }
        });

        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                save();
            }
            if (e.key === 'Escape') {
                form.remove();
            }
        });
    },

    /**
     * Delete an item by ID.
     * @param {number} itemId
     */
    async deleteItem(itemId) {
        const item = AppState.blocks.flatMap(b => b.items || []).find(i => i.id === itemId);
        const title = item ? (item.title || extractDomain(item.url || '') || 'this link') : 'this link';
        if (!confirm(`Delete "${title}"?`)) return;

        await api('items:delete', { id: itemId });
        await Blocks.load();
    },

    /**
     * Open the item edit modal.
     * @param {Object} item
     */
    openEditModal(item) {
        this._editItem = item;
        const overlay = document.getElementById('item-edit-overlay');
        const modal = document.getElementById('item-edit-modal');
        const urlInput = document.getElementById('item-edit-url');
        const titleInput = document.getElementById('item-edit-title');
        const saveBtn = document.getElementById('item-edit-save');
        const cancelBtn = document.getElementById('item-edit-cancel');
        const closeBtn = document.getElementById('item-edit-close');

        urlInput.value = item.url || '';
        titleInput.value = item.title || '';

        overlay.classList.add('open');
        modal.classList.add('open');

        // Focus the URL input
        setTimeout(() => urlInput.focus(), 100);

        const save = async () => {
            const url = urlInput.value.trim();
            const title = titleInput.value.trim();
            if (!url) {
                urlInput.focus();
                return;
            }

            await api('items:update', { id: item.id, url, title });
            this.closeEditModal();
            await Blocks.load();
        };

        saveBtn.onclick = save;
        cancelBtn.onclick = () => this.closeEditModal();
        closeBtn.onclick = () => this.closeEditModal();

        // Close on overlay click
        overlay.onclick = () => this.closeEditModal();

        // Keyboard handling
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                this.closeEditModal();
            }
            if (e.key === 'Enter' && e.target === titleInput) {
                e.preventDefault();
                save();
            }
            if (e.key === 'Enter' && e.target === urlInput) {
                e.preventDefault();
                titleInput.focus();
            }
        };

        urlInput.addEventListener('keydown', onKeydown);
        titleInput.addEventListener('keydown', onKeydown);
        this._editKeydownHandler = onKeydown;
    },

    /**
     * Close the item edit modal.
     */
    closeEditModal() {
        const overlay = document.getElementById('item-edit-overlay');
        const modal = document.getElementById('item-edit-modal');
        const urlInput = document.getElementById('item-edit-url');
        const titleInput = document.getElementById('item-edit-title');

        if (this._editKeydownHandler) {
            urlInput.removeEventListener('keydown', this._editKeydownHandler);
            titleInput.removeEventListener('keydown', this._editKeydownHandler);
            this._editKeydownHandler = null;
        }

        overlay.classList.remove('open');
        modal.classList.remove('open');
        this._editItem = null;
    },

    /**
     * Move an item within or between blocks.
     * @param {number} movedId
     * @param {number} fromBlockId
     * @param {number} toBlockId
     * @param {number} targetItemId
     * @param {string} position - 'before' or 'after'
     */
    async moveItem(movedId, fromBlockId, toBlockId, targetItemId, position = 'before') {
        const blocks = AppState.blocks;
        const fromBlock = blocks.find(b => b.id === fromBlockId);
        const toBlock = blocks.find(b => b.id === toBlockId);

        if (!fromBlock || !toBlock) return;

        const targetItems = [...(toBlock.items || [])];
        const movedIdx = targetItems.findIndex(i => i.id === movedId);
        if (movedIdx !== -1) {
            targetItems.splice(movedIdx, 1);
        }

        const targetIdx = targetItems.findIndex(i => i.id === targetItemId);
        if (targetIdx !== -1) {
            const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
            targetItems.splice(insertIdx, 0, { id: movedId });
        } else {
            targetItems.push({ id: movedId });
        }

        const moves = targetItems.map((item, idx) => ({
            id: item.id,
            block_id: toBlockId,
            sort_order: idx,
        }));

        if (fromBlockId !== toBlockId) {
            const sourceItems = (fromBlock.items || []).filter(i => i.id !== movedId);
            sourceItems.forEach((item, idx) => {
                moves.push({
                    id: item.id,
                    block_id: fromBlockId,
                    sort_order: idx,
                });
            });
        }

        await api('items:reorder', { moves });
        await Blocks.load();
    },

    /**
     * Move an item to the end of a target block.
     * @param {number} itemId
     * @param {number} targetBlockId
     */
    async moveItemToBlock(itemId, targetBlockId) {
        const sourceBlock = AppState.blocks.find(b => b.items?.some(i => i.id === itemId));
        if (!sourceBlock) return;

        const targetBlock = AppState.blocks.find(b => b.id === targetBlockId);
        if (!targetBlock) return;

        const targetItems = [...(targetBlock.items || [])];
        targetItems.push({ id: itemId });

        const moves = targetItems.map((item, idx) => ({
            id: item.id,
            block_id: targetBlockId,
            sort_order: idx,
        }));

        const sourceItems = (sourceBlock.items || []).filter(i => i.id !== itemId);
        sourceItems.forEach((item, idx) => {
            moves.push({
                id: item.id,
                block_id: sourceBlock.id,
                sort_order: idx,
            });
        });

        await api('items:reorder', { moves });
        await Blocks.load();
    },
};
