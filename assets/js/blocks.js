/**
 * blocks.js — Block rendering, drag-and-drop (reorder blocks), type picker.
 *
 * Orchestrates block rendering by delegating to Block type classes.
 */

const Blocks = {
    container: null,
    blockTemplate: null,
    dragState: null,

    /** @type {Map<number, Object>} blockId -> Block instance */
    _instances: new Map(),

    // Tracked drop position for block-level drag-and-drop
    _dropTargetColumn: null,
    _dropTargetBlockId: null,
    _dropPosition: null, // 'before' or 'after'

    init() {
        this.container = document.getElementById('blocks-container');
        this.blockTemplate = document.getElementById('block-template');

        const addBlockBtn = document.getElementById('add-block-btn');
        if (addBlockBtn) {
            addBlockBtn.addEventListener('click', () => {
                this.closeBlockMenus();
                this.addBlock();
            });
        }

        // Close block dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.block-kebab') && !e.target.closest('.block-dropdown')) {
                this.closeBlockMenus();
            }
        });

        // Container-level dragover for column drop zone tracking
        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.dragState && this.dragState.type === 'block') {
                this._updateDropZones(e.clientX, e.clientY);
            }
        });

        // Container-level drop — single source of truth for all block drops
        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!this.dragState || this.dragState.type !== 'block') return;

            const movedId = this.dragState.id;
            const targetCol = this._dropTargetColumn;
            const targetBlockId = this._dropTargetBlockId;
            const position = this._dropPosition;
            this._resetDropState();

            if (targetCol === null) return;

            // Use tracked drop position from the phantom
            if (targetBlockId) {
                this.reorderBlocks(movedId, targetBlockId, position);
                this.moveBlockToColumn(movedId, targetCol);
            } else {
                this.moveBlockToColumn(movedId, targetCol);
            }
        });
    },

    async load() {
        if (!AppState.currentPageId) {
            console.warn('Blocks.load: no currentPageId set');
            this.render([]);
            return;
        }

        const result = await api('blocks:get', { page_id: AppState.currentPageId });
        if (!result || !result.blocks) {
            console.warn('Blocks.load: no blocks returned', result);
            return;
        }
        AppState.blocks = result.blocks;

        // Destroy old block instances
        for (const instance of this._instances.values()) {
            instance.destroy();
        }
        this._instances.clear();

        this.render(result.blocks);
    },

    render(blocks) {
        this.container.innerHTML = '';

        if (blocks.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state" style="column-span: all;">
                    <h2>No blocks yet</h2>
                    <p>Click "+ Block" in the top bar to add your first block.</p>
                </div>
            `;
            return;
        }

        // In fixed column mode, group blocks into flex column wrappers
        const layout = Layout.get();
        const isFixed = layout !== 'auto';

        if (isFixed) {
            // Group blocks by column
            const columns = {};
            blocks.forEach(block => {
                const config = typeof block.config === 'string' ? JSON.parse(block.config) : (block.config || {});
                const col = config.column || 1;
                if (!columns[col]) columns[col] = [];
                columns[col].push(block);
            });

            // Create flex column wrappers
            const numCols = parseInt(layout, 10);
            for (let col = 1; col <= numCols; col++) {
                const colWrapper = document.createElement('div');
                colWrapper.className = 'layout-column';
                colWrapper.dataset.column = col;

                const colBlocks = columns[col] || [];
                colBlocks.forEach(block => {
                    const el = this.createBlockElement(block);
                    colWrapper.appendChild(el);
                });

                this.container.appendChild(colWrapper);
            }
        } else {
            // Auto (masonry) mode — just append in order
            blocks.forEach(block => {
                const el = this.createBlockElement(block);
                this.container.appendChild(el);
            });
        }
    },

    createBlockElement(block) {
        const clone = this.blockTemplate.content.cloneNode(true);
        const blockEl = clone.querySelector('.block');
        blockEl.dataset.id = block.id;
        blockEl.dataset.type = block.type || 'link_list';

        // Column property (default: 1)
        const config = typeof block.config === 'string' ? JSON.parse(block.config) : (block.config || {});
        const column = config.column || 1;
        blockEl.dataset.column = column;
        // gridColumn/gridRow set in render() for fixed layout mode

        // Title
        const titleEl = blockEl.querySelector('.block-title');
        titleEl.textContent = block.title;

        // Double-click to rename
        titleEl.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.renameBlockInline(block.id, titleEl);
        });

        // Kebab menu
        const kebabBtn = blockEl.querySelector('.block-kebab');
        const dropdown = blockEl.querySelector('.block-dropdown');
        kebabBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleBlockMenu(kebabBtn, dropdown);
        });

        // Dropdown: Rename
        dropdown.querySelector('.block-dropdown-item[data-action="rename"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeBlockMenus();
            this.renameBlockInline(block.id, titleEl);
        });

        // Dropdown: Config
        const configItem = dropdown.querySelector('.block-dropdown-item[data-action="config"]');
        if (configItem) {
            configItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeBlockMenus();
                const instance = this._instances.get(block.id);
                if (instance) {
                    instance.showConfigModal();
                }
            });
        }

        // Dropdown: Delete
        dropdown.querySelector('.block-dropdown-item[data-action="delete"]').addEventListener('click', () => {
            this.closeBlockMenus();
            this.deleteBlock(block.id);
        });

        // Add item button — only show for blocks that support items
        const addItemBtn = blockEl.querySelector('.add-item-btn');
        const blockType = block.type || 'link_list';
        const blockClass = Block.get(blockType);
        if (blockClass && blockClass.prototype.hasItems && new blockClass(block).hasItems()) {
            addItemBtn.style.display = '';
            addItemBtn.addEventListener('click', () => {
                const instance = this._instances.get(block.id);
                if (instance && instance.showAddForm) {
                    instance.showAddForm(blockEl);
                }
            });
        } else {
            addItemBtn.style.display = 'none';
        }

        // Block drag-and-drop
        blockEl.addEventListener('dragstart', (e) => {
            if (e.target !== blockEl) return;
            this.dragState = { type: 'block', id: block.id, el: blockEl };
            blockEl.classList.add('dragging');
            const container = document.getElementById('blocks-container');
            if (container) container.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', block.id.toString());

            // Create column drop zones and ghost (fixed layout mode)
            this._createDropZones();
        });

        blockEl.addEventListener('dragend', () => {
            blockEl.classList.remove('dragging');
            const container = document.getElementById('blocks-container');
            if (container) container.classList.remove('dragging');
            document.querySelectorAll('.block.drag-over').forEach(el => el.classList.remove('drag-over'));
            this._removeDropZones();
            this._resetDropState();
            this.dragState = null;
        });

        // Delegate content rendering to the block type class
        const itemsContainer = blockEl.querySelector('.block-items');
        const instance = Block.create(blockType, block);
        if (instance) {
            instance.render(itemsContainer);
            this._instances.set(block.id, instance);
        }

        return blockEl;
    },

    async renameBlockInline(blockId, titleEl) {
        const block = AppState.blocks.find(b => b.id === blockId);
        if (!block) return;

        const oldTitle = titleEl.textContent;
        titleEl.setAttribute('contenteditable', 'true');
        titleEl.focus();

        const range = document.createRange();
        range.selectNodeContents(titleEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const save = async () => {
            titleEl.removeAttribute('contenteditable');
            const newTitle = titleEl.textContent.trim();
            if (newTitle && newTitle !== oldTitle) {
                await api('blocks:update', { id: blockId, title: newTitle });
            }
        };

        const debouncedSave = debounce(save, 300);

        titleEl.addEventListener('blur', save, { once: true });
        titleEl.addEventListener('input', debouncedSave);
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleEl.blur();
            }
            if (e.key === 'Escape') {
                titleEl.textContent = oldTitle;
                titleEl.blur();
            }
        });
    },

    async deleteBlock(blockId) {
        const block = AppState.blocks.find(b => b.id === blockId);
        if (!block) return;
        if (!confirm(`Delete block "${block.title}"?`)) return;

        // Destroy the block instance
        const instance = this._instances.get(blockId);
        if (instance) {
            instance.destroy();
            this._instances.delete(blockId);
        }

        await api('blocks:delete', { id: blockId });
        await this.load();
    },

    /**
     * Open the block type picker modal.
     */
    addBlock() {
        const overlay = document.getElementById('type-picker-overlay');
        const modal = document.getElementById('type-picker-modal');
        const nameInput = document.getElementById('type-picker-name');
        const saveBtn = document.getElementById('type-picker-save');
        const cancelBtn = document.getElementById('type-picker-cancel');
        const typeCards = modal.querySelectorAll('.type-card');

        // Populate type cards from registry
        const typesContainer = modal.querySelector('.type-cards');
        typesContainer.innerHTML = '';
        const types = Block.getTypes();
        types.forEach((typeInfo, i) => {
            const card = document.createElement('div');
            card.className = 'type-card' + (i === 0 ? ' selected' : '');
            card.dataset.type = typeInfo.type;
            card.innerHTML = `
                <div class="type-card-icon">${this._getTypeIcon(typeInfo.type)}</div>
                <div class="type-card-label">${typeInfo.label}</div>
            `;
            card.addEventListener('click', () => {
                typesContainer.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
            typesContainer.appendChild(card);
        });

        nameInput.value = '';
        overlay.classList.add('open');
        modal.classList.add('open');
        setTimeout(() => nameInput.focus(), 100);

        const save = async () => {
            const name = nameInput.value.trim();
            if (!name) {
                nameInput.focus();
                return;
            }

            const selectedCard = typesContainer.querySelector('.type-card.selected');
            const selectedType = selectedCard ? selectedCard.dataset.type : 'link_list';

            // Get default config for the selected type
            const blockClass = Block.get(selectedType);
            const defaultConfig = blockClass && typeof blockClass.defaultConfig === 'function'
                ? blockClass.defaultConfig()
                : {};

            this.closeTypePicker();
            const result = await api('blocks:add', {
                page_id: AppState.currentPageId,
                title: name,
                type: selectedType,
                config: defaultConfig,
            });

            if (result && result.block) {
                await this.load();
            }
        };

        saveBtn.onclick = save;
        cancelBtn.onclick = () => this.closeTypePicker();
        const closeBtn = modal.querySelector('#type-picker-close');
        if (closeBtn) closeBtn.onclick = () => this.closeTypePicker();
        overlay.onclick = () => this.closeTypePicker();

        // Keyboard handling
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                this.closeTypePicker();
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                save();
            }
        };
        nameInput.addEventListener('keydown', onKeydown);
        this._typePickerKeydown = onKeydown;
    },

    closeTypePicker() {
        const overlay = document.getElementById('type-picker-overlay');
        const modal = document.getElementById('type-picker-modal');
        const nameInput = document.getElementById('type-picker-name');

        if (this._typePickerKeydown) {
            nameInput.removeEventListener('keydown', this._typePickerKeydown);
            this._typePickerKeydown = null;
        }

        overlay.classList.remove('open');
        modal.classList.remove('open');
    },

    _getTypeIcon(type) {
        switch (type) {
            case 'link_list': return '🔗';
            case 'clock': return '🕐';
            case 'iframe': return '🖥️';
            default: return '📦';
        }
    },

    _openDropdowns: new Map(),

    toggleBlockMenu(kebabBtn, dropdown) {
        const isOpen = dropdown.classList.contains('open');
        this.closeBlockMenus();
        if (!isOpen) {
            dropdown.classList.add('open');
            kebabBtn.setAttribute('aria-expanded', 'true');

            // Move dropdown to body to escape .block overflow:hidden
            const rect = kebabBtn.getBoundingClientRect();
            const parent = dropdown.parentElement;
            this._openDropdowns.set(dropdown, { parent, nextSibling: dropdown.nextElementSibling });

            document.body.appendChild(dropdown);
            dropdown.style.position = 'fixed';
            dropdown.style.top = (rect.bottom + 4) + 'px';
            dropdown.style.left = rect.left + 'px';

            // Reposition if overflowing viewport
            requestAnimationFrame(() => {
                const ddRect = dropdown.getBoundingClientRect();
                if (ddRect.right > window.innerWidth) {
                    dropdown.style.left = (window.innerWidth - ddRect.width - 8) + 'px';
                }
                if (ddRect.left < 0) {
                    dropdown.style.left = '8px';
                }
            });
        }
    },

    closeBlockMenus() {
        for (const [dropdown, info] of this._openDropdowns) {
            dropdown.classList.remove('open');
            dropdown.style.position = '';
            dropdown.style.top = '';
            dropdown.style.left = '';
            dropdown.style.right = '';
            info.parent.insertBefore(dropdown, info.nextSibling);
        }
        this._openDropdowns.clear();
        document.querySelectorAll('.block-kebab[aria-expanded="true"]').forEach(b =>
            b.setAttribute('aria-expanded', 'false')
        );
    },

    async reorderBlocks(movedId, targetId, position = 'after') {
        const blocks = [...AppState.blocks];
        const movedIdx = blocks.findIndex(b => b.id === movedId);
        const targetIdx = blocks.findIndex(b => b.id === targetId);

        if (movedIdx === -1 || targetIdx === -1) return;

        // Remove from old position, insert at new position
        const [moved] = blocks.splice(movedIdx, 1);
        // After splice, if movedIdx < targetIdx, the target shifted down by 1
        const adjustedTargetIdx = movedIdx < targetIdx ? targetIdx - 1 : targetIdx;
        const insertIdx = position === 'before' ? adjustedTargetIdx : adjustedTargetIdx + 1;
        blocks.splice(insertIdx, 0, moved);

        const order = blocks.map(b => b.id);
        await api('blocks:reorder', {
            page_id: AppState.currentPageId,
            order: order,
        });

        await this.load();
    },

    /**
     * Move a block to a specific column.
     * @param {number} blockId - Block ID to move
     * @param {number} targetColumn - Target column (1-indexed)
     */
    async moveBlockToColumn(blockId, targetColumn) {
        const block = AppState.blocks.find(b => b.id === blockId);
        if (!block) return;

        const config = typeof block.config === 'string' ? JSON.parse(block.config) : (block.config || {});
        config.column = targetColumn;

        await api('blocks:update', {
            id: blockId,
            config: config,
        });

        // Reload blocks to recompute grid-row positions
        await this.load();
    },

    /**
     * Create one phantom block element per column wrapper.
     */
    _createDropZones() {
        const container = this.container;
        if (!container || container.dataset.layout === 'auto') return;

        const colWrappers = container.querySelectorAll('.layout-column');

        colWrappers.forEach(wrapper => {
            const phantom = document.createElement('div');
            phantom.className = 'block-phantom';
            wrapper.appendChild(phantom);
        });
    },

    /**
     * Remove all phantom block elements.
     */
    _removeDropZones() {
        document.querySelectorAll('.block-phantom').forEach(el => el.remove());
    },

    /**
     * Reset tracked drop state.
     */
    _resetDropState() {
        this._dropTargetColumn = null;
        this._dropTargetBlockId = null;
        this._dropPosition = null;
    },

    /**
     * Update phantom block position based on mouse position.
     * Shows a dashed outline of the dragged block at the insertion point.
     * @param {number} clientX - Mouse X
     * @param {number} clientY - Mouse Y
     */
    _updateDropZones(clientX, clientY) {
        const container = this.container;
        if (!container || container.dataset.layout === 'auto') return;

        const colWrappers = container.querySelectorAll('.layout-column');

        // Find which column wrapper the mouse is over
        let targetWrapper = null;
        for (const wrapper of colWrappers) {
            const rect = wrapper.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right) {
                targetWrapper = wrapper;
                break;
            }
        }
        if (!targetWrapper) {
            // Hide all phantoms
            colWrappers.forEach(wrapper => {
                const phantom = wrapper.querySelector('.block-phantom');
                if (phantom) phantom.style.display = 'none';
            });
            return;
        }

        const targetCol = parseInt(targetWrapper.dataset.column, 10);

        // Hide phantoms in non-target columns
        colWrappers.forEach(wrapper => {
            const phantom = wrapper.querySelector('.block-phantom');
            if (phantom && wrapper !== targetWrapper) {
                phantom.style.display = 'none';
            }
        });

        // Find the phantom in the target column
        const phantom = targetWrapper.querySelector('.block-phantom');
        if (!phantom) return;

        // Size the phantom to match the dragged block
        const draggingEl = document.querySelector('.block.dragging');
        if (draggingEl) {
            phantom.style.width = draggingEl.offsetWidth + 'px';
            phantom.style.height = draggingEl.offsetHeight + 'px';
        }

        // Get all blocks in the target column (excluding the dragged one)
        const colBlocks = Array.from(targetWrapper.querySelectorAll('.block')).filter(
            b => parseInt(b.dataset.id, 10) !== this.dragState.id
        );

        if (colBlocks.length === 0) {
            // Empty column — show phantom at the top
            phantom.style.display = 'block';
            phantom.style.top = '0px';
            this._dropTargetColumn = targetCol;
            this._dropTargetBlockId = null;
            this._dropPosition = 'after';
            return;
        }

        // Find the nearest block by center-Y distance
        let closestBlock = null;
        let position = null;
        let minDistance = Infinity;

        for (const block of colBlocks) {
            const rect = block.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const distance = Math.abs(clientY - centerY);

            if (distance < minDistance) {
                minDistance = distance;
                closestBlock = block;
                position = clientY < centerY ? 'before' : 'after';
            }
        }

        // Position the phantom at the insertion point
        const wrapperRect = targetWrapper.getBoundingClientRect();
        let phantomTop;

        if (position === 'before') {
            phantomTop = closestBlock.getBoundingClientRect().top - wrapperRect.top;
        } else {
            phantomTop = closestBlock.getBoundingClientRect().bottom - wrapperRect.top;
        }

        phantom.style.display = 'block';
        phantom.style.top = phantomTop + 'px';

        // Track the drop position for the drop handler
        this._dropTargetColumn = targetCol;
        this._dropTargetBlockId = parseInt(closestBlock.dataset.id, 10);
        this._dropPosition = position;
    },
};
