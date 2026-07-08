/**
 * items.js — Item (link) editing, drag-and-drop (reorder/move items).
 *
 * Shared utilities used by LinkListBlock and other item-based blocks.
 * Container-level drag-and-drop is now handled by each block class.
 */

const Items = {
    itemTemplate: null,
    dragState: null,

    init() {
        this.itemTemplate = document.getElementById('item-template');
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
     * Open the item modal for editing an existing link.
     * @param {Object} item
     */
    openEditModal(item) {
        this._openItemModal(item, false);
    },

    /**
     * Open the item modal for adding a new link.
     * @param {number} blockId - Block ID to add the link to
     */
    openAddModal(blockId) {
        this._openItemModal({ id: null, block_id: blockId, url: '', title: '' }, true);
    },

    /**
     * Open the item modal (shared for add and edit modes).
     * @param {Object} item - Item data (id: null for add mode)
     * @param {boolean} isAddMode - Whether in add mode
     * @private
     */
    _openItemModal(item, isAddMode) {
        this._editItem = item;
        const overlay = document.getElementById('item-edit-overlay');
        const modal = document.getElementById('item-edit-modal');
        const heading = modal.querySelector('.item-edit-header h2');
        const urlInput = document.getElementById('item-edit-url');
        const titleInput = document.getElementById('item-edit-title');
        const saveBtn = document.getElementById('item-edit-save');
        const cancelBtn = document.getElementById('item-edit-cancel');
        const closeBtn = document.getElementById('item-edit-close');

        if (isAddMode) {
            heading.textContent = 'Add Link';
            saveBtn.textContent = 'Add';
            urlInput.value = '';
            titleInput.value = '';
        } else {
            heading.textContent = 'Edit Link';
            saveBtn.textContent = 'Save';
            urlInput.value = item.url || '';
            titleInput.value = item.title || '';
        }

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

            if (isAddMode) {
                await api('items:add', { block_id: item.block_id, url, title });
            } else {
                await api('items:update', { id: item.id, url, title });
            }
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
