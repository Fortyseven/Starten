/**
 * tabs.js — Page tab management + background editor.
 */

const Tabs = {
    container: null,

    // Background panel state
    panel: null,
    overlay: null,
    currentMode: 'solid',
    originalBackground: null,

    async init() {
        this.container = document.getElementById('tabs');
        this.panel = document.getElementById('bg-panel');
        this.overlay = document.getElementById('bg-panel-overlay');
        await this.load();

        // Add page button
        document.getElementById('add-page-btn').addEventListener('click', () => {
            this.closeTabMenus();
            this.addPage();
        });

        // Close tab dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.tab-kebab') && !e.target.closest('.tab-dropdown')) {
                this.closeTabMenus();
            }
        });

        // Background panel event listeners
        this.initBackgroundPanel();
    },

    initBackgroundPanel() {
        const closeBtn = document.getElementById('bg-panel-close');
        const cancelBtn = document.getElementById('bg-panel-cancel');
        const saveBtn = document.getElementById('bg-panel-save');

        // Close panel
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeBackgroundPanel());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeBackgroundPanel());
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveBackground());

        // Overlay click closes panel
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.closeBackgroundPanel());
        }

        // Escape key closes panel
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.panel && !this.panel.classList.contains('bg-hidden')) {
                this.closeBackgroundPanel();
            }
        });

        // Mode tabs
        document.querySelectorAll('.bg-mode-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchBgMode(tab.dataset.mode);
            });
        });

        // Live preview on input change
        const previewInputs = [
            'bg-solid-color',
            'bg-gradient-start',
            'bg-gradient-stop',
            'bg-gradient-angle',
            'bg-image-url',
        ];
        previewInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateBgPreview());
                el.addEventListener('change', () => this.updateBgPreview());
            }
        });

        // Image upload handler
        const uploadInput = document.getElementById('bg-image-upload');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleImageUpload(file);
                }
            });
        }
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

            // Kebab menu button
            const kebabBtn = document.createElement('button');
            kebabBtn.className = 'tab-kebab';
            kebabBtn.textContent = '⋮';
            kebabBtn.title = 'Page actions';
            kebabBtn.setAttribute('aria-haspopup', 'true');
            kebabBtn.setAttribute('aria-expanded', 'false');
            kebabBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTabMenu(kebabBtn, dropdown, page.id);
            });

            // Dropdown menu
            const dropdown = document.createElement('div');
            dropdown.className = 'tab-dropdown';
            dropdown.setAttribute('role', 'menu');

            const renameItem = document.createElement('button');
            renameItem.className = 'tab-dropdown-item';
            renameItem.setAttribute('role', 'menuitem');
            renameItem.innerHTML = '✏️ Rename';
            renameItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTabMenus();
                this.renamePageInline(page.id, nameSpan);
            });

            const editBgItem = document.createElement('button');
            editBgItem.className = 'tab-dropdown-item';
            editBgItem.setAttribute('role', 'menuitem');
            editBgItem.innerHTML = '🎨 Edit background';
            editBgItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTabMenus();
                this.editBackground(page.id);
            });

            const deleteItem = document.createElement('button');
            deleteItem.className = 'tab-dropdown-item tab-dropdown-item-danger';
            deleteItem.setAttribute('role', 'menuitem');
            deleteItem.innerHTML = '🗑 Delete page';
            deleteItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTabMenus();
                this.deletePage(page.id);
            });

            dropdown.appendChild(renameItem);
            dropdown.appendChild(editBgItem);
            dropdown.appendChild(deleteItem);

            tab.appendChild(nameSpan);
            tab.appendChild(kebabBtn);
            tab.appendChild(dropdown);

            // Click to switch
            tab.addEventListener('click', () => {
                this.closeTabMenus();
                this.select(page.id);
            });

            // Double-click to rename
            nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.renamePageInline(page.id, nameSpan);
            });

            this.container.appendChild(tab);
        });
    },

    toggleTabMenu(kebabBtn, dropdown, pageId) {
        const isOpen = dropdown.classList.contains('open');
        this.closeTabMenus();
        if (!isOpen) {
            dropdown.classList.add('open');
            kebabBtn.setAttribute('aria-expanded', 'true');

            // Reposition if overflowing viewport
            requestAnimationFrame(() => {
                const rect = dropdown.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                if (rect.right > viewportWidth) {
                    // Align dropdown's right edge to the tab's right edge
                    dropdown.style.right = '0';
                    dropdown.style.left = 'auto';
                }
                if (rect.left < 0) {
                    // Align dropdown's left edge to the tab's left edge
                    dropdown.style.left = '0';
                    dropdown.style.right = 'auto';
                }
            });
        }
    },

    closeTabMenus() {
        this.container.querySelectorAll('.tab-dropdown.open').forEach(d => {
            d.classList.remove('open');
            d.style.right = '';
            d.style.left = '';
        });
        this.container.querySelectorAll('.tab-kebab[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    },

    async select(pageId) {
        AppState.currentPageId = pageId;
        this.render();
        await Blocks.load();
        this.applyPageBackground(pageId);
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
                page.name = newName;
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

    // ===== Background Editor =====

    editBackground(pageId) {
        const page = AppState.pages.find(p => p.id === pageId);
        if (!page) return;

        // Parse current background
        let bg = {};
        try {
            bg = typeof page.background === 'string' ? JSON.parse(page.background) : page.background;
        } catch {
            bg = {};
        }
        if (!bg || typeof bg !== 'object') bg = {};

        // Store original for cancel
        this.originalBackground = bg;

        // Populate form
        const type = bg.type || 'solid';
        this.currentMode = type;

        // Solid
        const solidColor = document.getElementById('bg-solid-color');
        if (solidColor) solidColor.value = (bg.value && bg.value.color) || '#4361ee';

        // Gradient
        const gradStart = document.getElementById('bg-gradient-start');
        const gradStop = document.getElementById('bg-gradient-stop');
        const gradAngle = document.getElementById('bg-gradient-angle');
        const gradAngleValue = document.getElementById('bg-gradient-angle-value');
        if (gradStart) gradStart.value = (bg.value && bg.value.start) || '#4361ee';
        if (gradStop) gradStop.value = (bg.value && bg.value.stop) || '#f72585';
        if (gradAngle) gradAngle.value = (bg.value && bg.value.angle) || 135;
        if (gradAngleValue) gradAngleValue.textContent = `${(bg.value && bg.value.angle) || 135}°`;

        // Image
        const imageUrl = document.getElementById('bg-image-url');
        if (imageUrl) imageUrl.value = (bg.value && bg.value.url) || '';

        // Switch to the right mode tab
        this.switchBgMode(type);

        // Update preview
        this.updateBgPreview();

        // Show panel
        if (this.overlay) this.overlay.classList.remove('bg-hidden');
        if (this.panel) this.panel.classList.remove('bg-hidden');
    },

    closeBackgroundPanel() {
        if (this.overlay) this.overlay.classList.add('bg-hidden');
        if (this.panel) this.panel.classList.add('bg-hidden');
        this.originalBackground = null;
    },

    switchBgMode(mode) {
        this.currentMode = mode;

        // Update tabs
        document.querySelectorAll('.bg-mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // Update panels
        document.querySelectorAll('.bg-mode-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.mode === mode);
        });

        this.updateBgPreview();
    },

    updateBgPreview() {
        const previewArea = document.getElementById('bg-preview-area');
        const imagePreview = document.getElementById('bg-image-preview');
        if (!previewArea) return;

        // Clear existing
        previewArea.style.background = '';
        previewArea.style.backgroundImage = '';

        if (this.currentMode === 'solid') {
            const color = document.getElementById('bg-solid-color')?.value || '#4361ee';
            previewArea.style.background = color;
        } else if (this.currentMode === 'gradient') {
            const start = document.getElementById('bg-gradient-start')?.value || '#4361ee';
            const stop = document.getElementById('bg-gradient-stop')?.value || '#f72585';
            const angle = document.getElementById('bg-gradient-angle')?.value || 135;
            const angleDisplay = document.getElementById('bg-gradient-angle-value');
            if (angleDisplay) angleDisplay.textContent = `${angle}°`;
            previewArea.style.background = `linear-gradient(${angle}deg, ${start}, ${stop})`;
        } else if (this.currentMode === 'image') {
            const url = document.getElementById('bg-image-url')?.value || '';
            if (url) {
                previewArea.style.backgroundImage = `url('${url}')`;
                previewArea.style.backgroundSize = 'cover';
                previewArea.style.backgroundPosition = 'center';
            } else {
                previewArea.style.background = '#e0e0e0';
            }
        }
    },

    async saveBackground() {
        const pageId = AppState.currentPageId;
        if (!pageId) return;

        let background = { type: this.currentMode, value: {} };

        if (this.currentMode === 'solid') {
            const color = document.getElementById('bg-solid-color')?.value || '#4361ee';
            background.value = { color };
        } else if (this.currentMode === 'gradient') {
            const start = document.getElementById('bg-gradient-start')?.value || '#4361ee';
            const stop = document.getElementById('bg-gradient-stop')?.value || '#f72585';
            const angle = parseInt(document.getElementById('bg-gradient-angle')?.value || 135, 10);
            background.value = { start, stop, angle };
        } else if (this.currentMode === 'image') {
            const url = document.getElementById('bg-image-url')?.value || '';
            background.value = { url, fit: 'cover' };
        }

        // Send to server
        const result = await api('pages:update', { id: pageId, background });
        if (result && result.page) {
            // Update local state
            const page = AppState.pages.find(p => p.id === pageId);
            if (page) {
                page.background = result.page.background;
            }

            // Apply to DOM
            this.applyPageBackground(pageId);
        }

        this.closeBackgroundPanel();
    },

    applyPageBackground(pageId) {
        const page = AppState.pages.find(p => p.id === pageId);
        if (!page) return;

        let bg = {};
        try {
            bg = typeof page.background === 'string' ? JSON.parse(page.background) : page.background;
        } catch {
            bg = {};
        }
        if (!bg || typeof bg !== 'object' || !bg.type) {
            // No background — reset to default
            document.body.style.backgroundColor = '';
            document.body.style.backgroundImage = '';
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            return;
        }

        const value = bg.value || {};

        if (bg.type === 'solid') {
            document.body.style.backgroundColor = value.color || '';
            document.body.style.backgroundImage = '';
        } else if (bg.type === 'gradient') {
            const angle = value.angle ?? 135;
            const start = value.start || '#4361ee';
            const stop = value.stop || '#f72585';
            document.body.style.backgroundColor = '';
            document.body.style.backgroundImage = `linear-gradient(${angle}deg, ${start}, ${stop})`;
        } else if (bg.type === 'image' && value.url) {
            document.body.style.backgroundColor = '';
            document.body.style.backgroundImage = `url('${value.url}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
        }
    },

    handleImageUpload(file) {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = document.getElementById('bg-image-url');
            if (imageUrl) {
                imageUrl.value = e.target.result;
            }
            this.updateBgPreview();
        };
        reader.readAsDataURL(file);
    },
};
