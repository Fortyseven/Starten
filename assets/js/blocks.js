/**
 * blocks.js — Block rendering, drag-and-drop (reorder blocks).
 */

const Blocks = {
    container: null,
    blockTemplate: null,
    dragState: null,

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

        blocks.forEach(block => {
            const el = this.createBlockElement(block);
            this.container.appendChild(el);
        });
    },

    createBlockElement(block) {
        const clone = this.blockTemplate.content.cloneNode(true);
        const blockEl = clone.querySelector('.block');
        blockEl.dataset.id = block.id;
        blockEl.dataset.type = block.type || 'link_list';

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
        dropdown.querySelector('.block-dropdown-item:nth-child(1)').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeBlockMenus();
            this.renameBlockInline(block.id, titleEl);
        });

        // Dropdown: Delete
        dropdown.querySelector('.block-dropdown-item:nth-child(2)').addEventListener('click', () => {
            this.closeBlockMenus();
            this.deleteBlock(block.id);
        });

        // Add item button
        blockEl.querySelector('.add-item-btn').addEventListener('click', () => {
            Items.showAddForm(blockEl, block.id);
        });

        // Block drag-and-drop
        blockEl.addEventListener('dragstart', (e) => {
            if (e.target !== blockEl) return;
            this.dragState = { type: 'block', id: block.id, el: blockEl };
            blockEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', block.id.toString());
        });

        blockEl.addEventListener('dragend', () => {
            blockEl.classList.remove('dragging');
            document.querySelectorAll('.block.drag-over').forEach(el => el.classList.remove('drag-over'));
            this.dragState = null;
        });

        blockEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.dragState && this.dragState.type === 'block' && this.dragState.id !== block.id) {
                blockEl.classList.add('drag-over');
            }
        });

        blockEl.addEventListener('dragleave', () => {
            blockEl.classList.remove('drag-over');
        });

        blockEl.addEventListener('drop', (e) => {
            e.preventDefault();
            blockEl.classList.remove('drag-over');
            if (this.dragState && this.dragState.type === 'block' && this.dragState.id !== block.id) {
                this.reorderBlocks(this.dragState.id, block.id);
            }
        });

        // Render items
        const itemsContainer = blockEl.querySelector('.block-items');
        const items = block.items || [];
        items.forEach(item => {
            const itemEl = Items.createItemElement(item);
            itemsContainer.appendChild(itemEl);
        });

        // Setup container-level drag-and-drop (once per block)
        Items.setupContainer(itemsContainer);

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

        await api('blocks:delete', { id: blockId });
        await this.load();
    },

    async addBlock() {
        const name = prompt('Block title:');
        if (!name || name.trim() === '') return;

        const result = await api('blocks:add', {
            page_id: AppState.currentPageId,
            title: name.trim(),
            type: 'link_list',
        });

        if (result && result.block) {
            await this.load();
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

    async reorderBlocks(movedId, targetId) {
        const blocks = [...AppState.blocks];
        const movedIdx = blocks.findIndex(b => b.id === movedId);
        const targetIdx = blocks.findIndex(b => b.id === targetId);

        if (movedIdx === -1 || targetIdx === -1) return;

        // Remove from old position, insert at new position
        const [moved] = blocks.splice(movedIdx, 1);
        blocks.splice(targetIdx, 0, moved);

        const order = blocks.map(b => b.id);
        await api('blocks:reorder', {
            page_id: AppState.currentPageId,
            order: order,
        });

        await this.load();
    },
};
