/**
 * items.js — Item (link) editing, drag-and-drop (reorder/move items).
 */

const Items = {
    itemTemplate: null,
    addFormTemplate: null,
    dragState: null,
    _setupContainers: new Set(),

    init() {
        this.itemTemplate = document.getElementById('item-template');
        this.addFormTemplate = document.getElementById('add-item-form');
    },

    /**
     * Attach container-level drag-and-drop listeners once per block-items container.
     * Call from blocks.js after rendering items.
     */
    setupContainer(container) {
        if (this._setupContainers.has(container)) return;
        this._setupContainers.add(container);

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!this.dragState || this.dragState.type !== 'item') return;

            const draggedId = this.dragState.id;
            const items = [...container.querySelectorAll('.block-item')].filter(i => parseInt(i.dataset.id) !== draggedId);
            let closestItem = null;
            let position = null;
            let minDistance = Infinity;

            for (const item of items) {
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const distance = Math.abs(e.clientY - midY);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestItem = item;
                    position = e.clientY < midY ? 'before' : 'after';
                }
            }

            this._showDropIndicator(container, closestItem, position);
        });

        container.addEventListener('dragleave', (e) => {
            // Only hide if actually leaving the container
            if (!container.contains(e.relatedTarget)) {
                this._hideDropIndicator();
                const blockEl = container.closest('.block');
                if (blockEl) blockEl.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Read stored state BEFORE clearing it
            const targetItemId = this._dropTargetId;
            const position = this._dropPosition;
            this._dropTargetId = null;
            this._dropPosition = null;
            this._hideDropIndicator();

            const blockEl = container.closest('.block');
            if (blockEl) blockEl.classList.remove('drag-over');

            if (!this.dragState || this.dragState.type !== 'item') return;

            const { id: movedId, blockId: fromBlockId } = this.dragState;
            const toBlockId = parseInt(blockEl.dataset.id);

            if (fromBlockId === toBlockId) {
                // Same-block reorder
                if (targetItemId) {
                    this.moveItem(movedId, fromBlockId, toBlockId, targetItemId, position);
                }
                // If no target item (empty block or indicator lost), do nothing
            } else {
                // Cross-block move
                if (targetItemId) {
                    this.moveItem(movedId, fromBlockId, toBlockId, targetItemId, position);
                } else {
                    // Drop at end of target block
                    this.moveItemToBlock(movedId, toBlockId);
                }
            }
        });
    },

    /**
     * Show the visual drop indicator at the calculated position.
     */
    _showDropIndicator(container, targetItem, position) {
        let indicator = container.querySelector('.drop-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            container.appendChild(indicator);
        }

        if (!targetItem) {
            // No items in block — show at bottom
            indicator.style.display = 'block';
            indicator.style.position = 'absolute';
            indicator.style.bottom = '0';
            indicator.style.top = 'auto';
            this._dropTargetId = null;
            this._dropPosition = 'after';
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const itemRect = targetItem.getBoundingClientRect();

        indicator.style.display = 'block';
        indicator.style.position = 'absolute';
        indicator.style.left = '0';
        indicator.style.right = '0';

        if (position === 'before') {
            indicator.style.top = (itemRect.top - containerRect.top) + 'px';
        } else {
            indicator.style.top = (itemRect.bottom - containerRect.top) + 'px';
        }

        this._dropTargetId = parseInt(targetItem.dataset.id);
        this._dropPosition = position;
    },

    /**
     * Hide the drop indicator.
     */
    _hideDropIndicator() {
        const indicator = document.querySelector('.drop-indicator');
        if (indicator) indicator.remove();
        this._dropTargetId = null;
        this._dropPosition = null;
    },

    createItemElement(item) {
        this.init();
        const clone = this.itemTemplate.content.cloneNode(true);
        const itemEl = clone.querySelector('.block-item');
        itemEl.dataset.id = item.id;
        itemEl.dataset.blockId = item.block_id;

        // Store URL for click navigation
        const url = item.url || null;
        if (url) {
            itemEl.dataset.url = url;
            itemEl.style.cursor = 'pointer';
            const favicon = itemEl.querySelector('.item-favicon');
            favicon.src = faviconUrl(url);
            favicon.onerror = () => {
                favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="%23ccc"/></svg>';
            };
            itemEl.tabIndex = 0; // Make focusable for keyboard access
        } else {
            itemEl.style.cursor = 'default';
        }

        // Title
        const titleEl = itemEl.querySelector('.item-title');
        titleEl.textContent = item.title || (url ? extractDomain(url) : 'Untitled');

        // Click to navigate (for items with URL)
        if (url) {
            itemEl.addEventListener('click', (e) => {
                // Don't navigate if clicking buttons
                if (e.target.closest('.item-actions')) return;
                // Don't navigate if this was a drag
                if (e.detail === 0 && itemEl.classList.contains('dragging')) return;
                window.open(url, '_blank', 'noopener');
            });

            // Keyboard: Enter to navigate
            itemEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    window.open(url, '_blank', 'noopener');
                }
            });
        }

        // Edit button
        itemEl.querySelector('.item-edit-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openEditModal(item);
        });

        // Delete button
        itemEl.querySelector('.item-delete-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.deleteItem(item.id);
        });

        // --- Drag-and-drop for items ---

        itemEl.addEventListener('dragstart', (e) => {
            // Don't drag from block-level drag handle
            if (e.target.closest('.block-drag-handle')) return;
            e.stopPropagation();

            this.dragState = { type: 'item', id: item.id, blockId: item.block_id };
            itemEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `item:${item.id}`);

            // Also highlight the source block
            const blockEl = itemEl.closest('.block');
            if (blockEl) blockEl.classList.add('drag-over');
        });

        itemEl.addEventListener('dragend', () => {
            itemEl.classList.remove('dragging');
            this._hideDropIndicator();
            document.querySelectorAll('.block.drag-over').forEach(el => el.classList.remove('drag-over'));
            this.dragState = null;
        });

        // Per-item dragover: allow drop, let event bubble to container for positioning
        itemEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            // Don't stopPropagation — let container handler position the drop indicator
        });

        // Per-item drop: allow drop, let event bubble to container for processing
        itemEl.addEventListener('drop', (e) => {
            e.preventDefault();
            // Don't stopPropagation — let container handler process the move
        });

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
        const item = AppState.blocks.flatMap(b => b.items || []).find(i => i.id === itemId);
        const title = item ? (item.title || extractDomain(item.url || '') || 'this link') : 'this link';
        if (!confirm(`Delete "${title}"?`)) return;

        await api('items:delete', { id: itemId });
        await Blocks.load();
    },

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

    async moveItem(movedId, fromBlockId, toBlockId, targetItemId, position = 'before') {
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

        // Find the index before/after which to insert
        const targetIdx = targetItems.findIndex(i => i.id === targetItemId);
        if (targetIdx !== -1) {
            const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
            targetItems.splice(insertIdx, 0, { id: movedId });
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

        // Also renumber source block
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
