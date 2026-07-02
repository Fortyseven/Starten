/**
 * LinkListBlock — The default block type: a list of links (items).
 *
 * Refactored from the original items.js logic. Handles rendering items,
 * item drag-and-drop, adding/editing/deleting items.
 */

class LinkListBlock extends BlockBase {
    static label() {
        return 'Link List';
    }

    static type() {
        return 'link_list';
    }

    static defaultConfig() {
        return {};
    }

    constructor(blockData) {
        super(blockData);
        this._dropTargetId = null;
        this._dropPosition = null;
    }

    hasItems() {
        return true;
    }

    /**
     * Render all items into the block-items container and set up drag-and-drop.
     * @param {HTMLElement} container - The .block-items container
     */
    render(container) {
        const items = this.items || [];
        items.forEach(item => {
            const itemEl = this._createItemElement(item);
            container.appendChild(itemEl);
        });
        this._setupContainer(container);
    }

    /**
     * Create an item element from item data.
     * @param {Object} item
     * @returns {HTMLElement}
     */
    _createItemElement(item) {
        const itemTemplate = document.getElementById('item-template');
        if (!itemTemplate) return document.createElement('div');

        const clone = itemTemplate.content.cloneNode(true);
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
            itemEl.tabIndex = 0;
        } else {
            itemEl.style.cursor = 'default';
        }

        // Title
        const titleEl = itemEl.querySelector('.item-title');
        titleEl.textContent = item.title || (url ? extractDomain(url) : 'Untitled');

        // Click to navigate
        if (url) {
            itemEl.addEventListener('click', (e) => {
                if (e.target.closest('.item-actions')) return;
                if (e.detail === 0 && itemEl.classList.contains('dragging')) return;
                window.open(url, '_blank', 'noopener');
            });

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
            Items.openEditModal(item);
        });

        // Delete button
        itemEl.querySelector('.item-delete-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Items.deleteItem(item.id);
        });

        // Drag-and-drop
        itemEl.addEventListener('dragstart', (e) => {
            if (e.target.closest('.block-drag-handle')) return;
            e.stopPropagation();

            Items.dragState = { type: 'item', id: item.id, blockId: item.block_id };
            itemEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `item:${item.id}`);

            const blockEl = itemEl.closest('.block');
            if (blockEl) blockEl.classList.add('drag-over');
        });

        itemEl.addEventListener('dragend', () => {
            itemEl.classList.remove('dragging');
            this._hideDropIndicator();
            document.querySelectorAll('.block.drag-over').forEach(el => el.classList.remove('drag-over'));
            Items.dragState = null;
        });

        itemEl.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        itemEl.addEventListener('drop', (e) => {
            e.preventDefault();
        });

        return itemEl;
    }

    /**
     * Set up container-level drag-and-drop for item reordering.
     * @param {HTMLElement} container
     * @private
     */
    _setupContainer(container) {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!Items.dragState || Items.dragState.type !== 'item') return;

            const draggedId = Items.dragState.id;
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
            if (!container.contains(e.relatedTarget)) {
                this._hideDropIndicator();
                const blockEl = container.closest('.block');
                if (blockEl) blockEl.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const targetItemId = this._dropTargetId;
            const position = this._dropPosition;
            this._dropTargetId = null;
            this._dropPosition = null;
            this._hideDropIndicator();

            const blockEl = container.closest('.block');
            if (blockEl) blockEl.classList.remove('drag-over');

            if (!Items.dragState || Items.dragState.type !== 'item') return;

            const { id: movedId, blockId: fromBlockId } = Items.dragState;
            const toBlockId = parseInt(blockEl.dataset.id);

            if (fromBlockId === toBlockId) {
                if (targetItemId) {
                    Items.moveItem(movedId, fromBlockId, toBlockId, targetItemId, position);
                }
            } else {
                if (targetItemId) {
                    Items.moveItem(movedId, fromBlockId, toBlockId, targetItemId, position);
                } else {
                    Items.moveItemToBlock(movedId, toBlockId);
                }
            }
        });
    }

    /**
     * Show the visual drop indicator.
     * @private
     */
    _showDropIndicator(container, targetItem, position) {
        let indicator = container.querySelector('.drop-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            container.appendChild(indicator);
        }

        if (!targetItem) {
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
    }

    /**
     * Hide the drop indicator.
     * @private
     */
    _hideDropIndicator() {
        const indicator = document.querySelector('.drop-indicator');
        if (indicator) indicator.remove();
        this._dropTargetId = null;
        this._dropPosition = null;
    }

    /**
     * Show the add-item form for this block.
     * @param {HTMLElement} blockEl - The .block element
     */
    showAddForm(blockEl) {
        Items.showAddForm(blockEl, this.blockId);
    }

    /**
     * Config modal — for link list blocks, just a simple title rename.
     * The inline rename (double-click) is the primary way to change title.
     */
    showConfigModal() {
        // Link list blocks don't need a config modal beyond title rename
        // The inline rename handles that already
    }
}

// Register this block type
Block.register(LinkListBlock.type(), LinkListBlock);
