/**
 * items.js — Item (link) editing, drag-and-drop (reorder/move items).
 */

const Items = {
    itemTemplate: null,
    addFormTemplate: null,
    dragState: null,

    init() {
        this.itemTemplate = document.getElementById('item-template');
        this.addFormTemplate = document.getElementById('add-item-form');
    },

    createItemElement(item) {
        this.init();
        const clone = this.itemTemplate.content.cloneNode(true);
        const itemEl = clone.querySelector('.block-item');
        itemEl.dataset.id = item.id;
        itemEl.dataset.blockId = item.block_id;

        // Set URL and favicon
        if (item.url) {
            itemEl.href = item.url;
            const favicon = itemEl.querySelector('.item-favicon');
            favicon.src = faviconUrl(item.url);
            favicon.onerror = () => {
                favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="%23ccc"/></svg>';
            };
        } else {
            itemEl.removeAttribute('href');
            itemEl.style.cursor = 'default';
        }

        // Title
        const titleEl = itemEl.querySelector('.item-title');
        titleEl.textContent = item.title || (item.url ? extractDomain(item.url) : 'Untitled');

        // Delete button
        itemEl.querySelector('.delete-item-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.deleteItem(item.id);
        });

        // Drag-and-drop for items
        itemEl.addEventListener('dragstart', (e) => {
            // Only drag items, not the block itself
            if (e.target.closest('.block-drag-handle')) return;
            e.stopPropagation();

            this.dragState = { type: 'item', id: item.id, blockId: item.block_id, el: itemEl };
            itemEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `item:${item.id}`);
        });

        itemEl.addEventListener('dragend', () => {
            itemEl.classList.remove('dragging');
            document.querySelectorAll('.block-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            document.querySelectorAll('.block.drag-over').forEach(el => el.classList.remove('drag-over'));
            this.dragState = null;
        });

        itemEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.dragState && this.dragState.type === 'item') {
                itemEl.classList.add('drag-over');
            }
        });

        itemEl.addEventListener('dragleave', () => {
            itemEl.classList.remove('drag-over');
        });

        itemEl.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            itemEl.classList.remove('drag-over');

            if (this.dragState && this.dragState.type === 'item' && this.dragState.id !== item.id) {
                this.moveItem(this.dragState.id, this.dragState.blockId, item.blockId, item.id);
            }
        });

        // Also make the items container a drop zone for inter-block moves
        const parentContainer = itemEl.parentElement;
        if (parentContainer) {
            parentContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.dragState && this.dragState.type === 'item') {
                    const blockEl = parentContainer.closest('.block');
                    if (blockEl && parseInt(blockEl.dataset.id) !== this.dragState.blockId) {
                        blockEl.classList.add('drag-over');
                    }
                }
            });

            parentContainer.addEventListener('dragleave', (e) => {
                const blockEl = parentContainer.closest('.block');
                if (blockEl) blockEl.classList.remove('drag-over');
            });

            parentContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                const blockEl = parentContainer.closest('.block');
                if (blockEl) blockEl.classList.remove('drag-over');

                if (this.dragState && this.dragState.type === 'item') {
                    const targetBlockId = parseInt(blockEl.dataset.id);
                    if (targetBlockId !== this.dragState.blockId) {
                        // Drop at end of block
                        this.moveItemToBlock(this.dragState.id, targetBlockId);
                    }
                }
            });
        }

        return itemEl;
    },

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

    async deleteItem(itemId) {
        await api('items:delete', { id: itemId });
        await Blocks.load();
    },

    async moveItem(movedId, fromBlockId, toBlockId, beforeId) {
        // Get all items for affected blocks and reorder
        const blocks = AppState.blocks;
        const fromBlock = blocks.find(b => b.id === fromBlockId);
        const toBlock = blocks.find(b => b.id === toBlockId);

        if (!fromBlock || !toBlock) return;

        // Build new order for the target block
        const targetItems = [...(toBlock.items || [])];

        // Remove the moved item from the target block items if it was already there
        const movedIdx = targetItems.findIndex(i => i.id === movedId);
        if (movedIdx !== -1) {
            targetItems.splice(movedIdx, 1);
        }

        // Find the index before which to insert
        const beforeIdx = targetItems.findIndex(i => i.id === beforeId);
        if (beforeIdx !== -1) {
            targetItems.splice(beforeIdx, 0, { id: movedId });
        } else {
            targetItems.push({ id: movedId });
        }

        // Build moves array
        const moves = targetItems.map((item, idx) => ({
            id: item.id,
            block_id: toBlockId,
            sort_order: idx,
        }));

        // Also fix the source block if different
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

    async moveItemToBlock(itemId, targetBlockId) {
        // Move item to the end of the target block
        const blocks = AppState.blocks;
        const targetBlock = blocks.find(b => b.id === targetBlockId);
        if (!targetBlock) return;

        const targetItems = [...(targetBlock.items || [])];
        const beforeId = targetItems.length > 0 ? targetItems[targetItems.length - 1].id : null;

        if (beforeId) {
            await this.moveItem(itemId, parseInt(targetBlockId === AppState.blocks.find(b => b.items?.some(i => i.id === itemId)) ? targetBlockId : 0), targetBlockId, beforeId);
        } else {
            // Empty block, just move it
            const sourceBlock = AppState.blocks.find(b => b.items?.some(i => i.id === itemId));
            const moves = [{ id: itemId, block_id: targetBlockId, sort_order: 0 }];
            if (sourceBlock) {
                await api('items:reorder', { moves });
                await Blocks.load();
            }
        }
    },
};
