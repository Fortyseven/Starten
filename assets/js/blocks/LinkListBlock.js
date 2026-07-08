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
        return { view: 'list' };
    }

    constructor(blockData) {
        super(blockData);
        this._dropTargetId = null;
        this._dropPosition = null;
        this._configModalOpen = false;
        // Ensure config has view default
        if (!this.config.view) {
            this.config.view = 'list';
        }
    }

    /**
     * Get the current view mode.
     * @returns {'list'|'icon'}
     */
    get view() {
        return this.config.view || 'list';
    }

    /**
     * Check if currently in icon view.
     * @returns {boolean}
     */
    isIconView() {
        return this.view === 'icon';
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
        const isIcon = this.isIconView();

        // Set view class on container for CSS targeting
        container.classList.toggle('view-list', !isIcon);
        container.classList.toggle('view-icon', isIcon);

        items.forEach(item => {
            const itemEl = this._createItemElement(item, isIcon);
            container.appendChild(itemEl);
        });

        if (!isIcon) {
            this._setupContainer(container);
        }
    }

    /**
     * Create an item element from item data.
     * @param {Object} item
     * @param {boolean} isIcon - Whether rendering in icon view
     * @returns {HTMLElement}
     */
    _createItemElement(item, isIcon) {
        const url = item.url || null;
        const title = item.title || (url ? extractDomain(url) : 'Untitled');

        if (isIcon) {
            return this._createIconItemElement(item, url, title);
        }

        return this._createListItemElement(item, url, title);
    }

    /**
     * Create a list-view item element (horizontal row).
     * @param {Object} item
     * @param {string|null} url
     * @param {string} title
     * @returns {HTMLElement}
     */
    _createListItemElement(item, url, title) {
        const itemTemplate = document.getElementById('item-template');
        if (!itemTemplate) return document.createElement('div');

        const clone = itemTemplate.content.cloneNode(true);
        const itemEl = clone.querySelector('.block-item');
        itemEl.dataset.id = item.id;
        itemEl.dataset.blockId = item.block_id;

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

        const titleEl = itemEl.querySelector('.item-title');
        titleEl.textContent = title;

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

        itemEl.querySelector('.item-edit-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Items.openEditModal(item);
        });

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
     * Create an icon-view item element (compact grid card).
     * @param {Object} item
     * @param {string|null} url
     * @param {string} title
     * @returns {HTMLElement}
     */
    _createIconItemElement(item, url, title) {
        const itemEl = document.createElement('div');
        itemEl.className = 'block-item block-item-icon';
        itemEl.dataset.id = item.id;
        itemEl.dataset.blockId = item.block_id;

        if (url) {
            itemEl.dataset.url = url;
            itemEl.tabIndex = 0;
        }

        // Favicon — larger, centered
        const favicon = document.createElement('img');
        favicon.className = 'item-favicon';
        if (url) {
            favicon.src = faviconUrl(url);
            favicon.onerror = () => {
                favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="%23ccc"/></svg>';
            };
        }

        // Title
        const titleEl = document.createElement('span');
        titleEl.className = 'item-title';
        titleEl.textContent = title;

        // Action buttons (hidden by default, show on hover)
        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'item-edit-btn';
        editBtn.setAttribute('title', 'Edit');
        editBtn.setAttribute('aria-label', 'Edit');
        editBtn.innerHTML = '&#9998;';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'item-delete-btn';
        deleteBtn.setAttribute('title', 'Delete');
        deleteBtn.setAttribute('aria-label', 'Delete');
        deleteBtn.innerHTML = '&times;';

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        itemEl.appendChild(favicon);
        itemEl.appendChild(titleEl);
        itemEl.appendChild(actions);

        // Click to navigate
        if (url) {
            itemEl.addEventListener('click', (e) => {
                if (e.target.closest('.item-actions')) return;
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
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Items.openEditModal(item);
        });

        // Delete button
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Items.deleteItem(item.id);
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
     * Open the add-link modal for this block.
     * @param {HTMLElement} blockEl - The .block element (kept for API compat)
     */
    showAddForm(blockEl) {
        Items.openAddModal(this.blockId);
    }

    /**
     * Show the link list configuration modal (view mode toggle).
     */
    showConfigModal() {
        if (this._configModalOpen) return;
        this._configModalOpen = true;

        const overlay = document.createElement('div');
        overlay.className = 'type-picker-overlay';

        const modal = document.createElement('div');
        modal.className = 'link-list-config-modal';
        modal.innerHTML = `
            <div class="link-list-config-header">
                <h2>Block Settings</h2>
                <button class="link-list-config-close" aria-label="Close">&times;</button>
            </div>
            <div class="link-list-config-body">
                <div class="link-list-config-section">
                    <div class="link-list-config-label">View mode</div>
                    <div class="link-list-view-options">
                        <button class="link-list-view-option" data-view="list">
                            <span class="link-list-view-option-icon">&#9776;</span>
                            <span class="link-list-view-option-label">List</span>
                        </button>
                        <button class="link-list-view-option" data-view="icon">
                            <span class="link-list-view-option-icon">&#9635;</span>
                            <span class="link-list-view-option-label">Icon</span>
                        </button>
                    </div>
                </div>
            </div>
            <div class="link-list-config-footer">
                <button class="link-list-config-btn link-list-config-btn-secondary" id="link-list-config-cancel">Cancel</button>
                <button class="link-list-config-btn link-list-config-btn-primary" id="link-list-config-save">Save</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // Set current view as selected
        const options = modal.querySelectorAll('.link-list-view-option');
        options.forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.view === this.view);
        });

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('open');
            modal.classList.add('open');
        });

        let selectedView = this.view;

        // Click to select view option
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedView = opt.dataset.view;
            });
        });

        // Close handler
        let closed = false;
        const close = () => {
            if (closed) return;
            closed = true;
            this._configModalOpen = false;

            overlay.classList.remove('open');
            modal.classList.remove('open');
            setTimeout(() => { overlay.remove(); modal.remove(); }, 250);
        };

        // Save handler
        const save = async () => {
            const newConfig = { ...this.config, view: selectedView };

            await api('blocks:update', {
                id: this.blockId,
                config: newConfig,
            });

            if (!closed) {
                closed = true;
                this._configModalOpen = false;
            }
            overlay.classList.remove('open');
            modal.classList.remove('open');
            setTimeout(() => { overlay.remove(); modal.remove(); }, 300);

            await Blocks.load();
        };

        modal.querySelector('#link-list-config-save').addEventListener('click', save);
        modal.querySelector('#link-list-config-cancel').addEventListener('click', close);
        modal.querySelector('.link-list-config-close').addEventListener('click', close);
        overlay.addEventListener('click', close);

        // Keyboard
        const onKeydown = (e) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', onKeydown);
        this._linkListConfigKeydown = onKeydown;
    }

    /**
     * Clean up resources.
     */
    destroy() {
        if (this._linkListConfigKeydown) {
            document.removeEventListener('keydown', this._linkListConfigKeydown);
            this._linkListConfigKeydown = null;
        }
        this._configModalOpen = false;
        super.destroy();
    }
}

// Register this block type
Block.register(LinkListBlock.type(), LinkListBlock);
