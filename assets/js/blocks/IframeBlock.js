/**
 * IframeBlock — Embeds an external URL via <iframe> or renders raw HTML inline.
 *
 * Config format:
 * {
 *   "mode": "url",       // "url" | "html"
 *   "url": "",           // external URL (when mode = "url")
 *   "html": "",          // raw HTML string (when mode = "html")
 *   "height": 400,       // iframe/container height in pixels
 *   "bordered": true     // show card border
 * }
 */

class IframeBlock extends BlockBase {
    static label() {
        return 'IFrame';
    }

    static type() {
        return 'iframe';
    }

    static defaultConfig() {
        return {
            mode: 'url',
            url: '',
            html: '',
            height: 400,
            bordered: true,
        };
    }

    constructor(blockData) {
        super(blockData);
        this._configModalOpen = false;
        // Ensure config has defaults
        if (!this.config.mode) {
            this.config.mode = 'url';
        }
        if (!this.config.url) {
            this.config.url = '';
        }
        if (!this.config.html) {
            this.config.html = '';
        }
        if (!this.config.height) {
            this.config.height = 400;
        }
        if (this.config.bordered === undefined) {
            this.config.bordered = true;
        }
    }

    /**
     * Render the iframe or HTML content into the container.
     * @param {HTMLElement} container - The .block-items container
     */
    render(container) {
        container.classList.add('iframe-container');
        container.innerHTML = '';

        // Apply height
        container.style.height = this.config.height + 'px';

        // Apply border styling
        container.classList.toggle('iframe-bordered', this.config.bordered);

        const hasUrl = this.config.mode === 'url' && this.config.url && this._isValidUrl(this.config.url);
        const hasHtml = this.config.mode === 'html' && this.config.html && this.config.html.trim().length > 0;

        if (hasUrl) {
            const iframe = document.createElement('iframe');
            iframe.src = this.config.url;
            iframe.sandbox = 'allow-scripts allow-same-origin';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.display = 'block';
            iframe.setAttribute('loading', 'lazy');
            iframe.setAttribute('allowfullscreen', '');
            container.appendChild(iframe);
        } else if (hasHtml) {
            container.innerHTML = this.config.html;
            // Re-apply classes and styles since innerHTML clears them
            container.classList.add('iframe-container');
            container.style.height = this.config.height + 'px';
            container.classList.toggle('iframe-bordered', this.config.bordered);
        } else {
            // Empty state placeholder
            const empty = document.createElement('div');
            empty.className = 'iframe-empty-state';
            empty.innerHTML = `
                <p>No URL or HTML configured.</p>
                <p>Click <strong>&vellip; &rarr; Config</strong> to set one up.</p>
            `;
            container.appendChild(empty);
        }
    }

    /**
     * Update the iframe height directly in the DOM without full re-render.
     * @param {number} newHeight
     */
    updateHeight(newHeight) {
        this.config.height = newHeight;
        const container = document.querySelector(`.block[data-id="${this.blockId}"] .iframe-container`);
        if (container) {
            container.style.height = newHeight + 'px';
        }
    }

    /**
     * Show the iframe configuration modal.
     */
    showConfigModal() {
        if (this._configModalOpen) return;
        this._configModalOpen = true;

        // Create modal elements
        const overlay = document.createElement('div');
        overlay.className = 'type-picker-overlay';
        overlay.id = 'iframe-config-overlay';

        const modal = document.createElement('div');
        modal.className = 'iframe-config-modal';
        modal.id = 'iframe-config-modal';

        const isUrlMode = this.config.mode === 'url';

        modal.innerHTML = `
            <div class="iframe-config-header">
                <h2>IFrame Settings</h2>
                <button class="iframe-config-close" aria-label="Close">&times;</button>
            </div>
            <div class="iframe-config-body">
                <div class="iframe-config-section">
                    <div class="iframe-config-label">Mode</div>
                    <div class="iframe-mode-toggle">
                        <button class="iframe-mode-btn ${isUrlMode ? 'active' : ''}" data-mode="url">URL Embed</button>
                        <button class="iframe-mode-btn ${!isUrlMode ? 'active' : ''}" data-mode="html">Raw HTML</button>
                    </div>
                </div>

                <div class="iframe-config-section iframe-url-section ${isUrlMode ? '' : 'hidden'}">
                    <div class="iframe-config-label">URL
                        <input type="text" id="iframe-url-input" class="iframe-config-input" value="${this._escapeAttr(this.config.url)}" placeholder="https://example.com">
                    </div>
                    <div class="iframe-config-error" id="iframe-url-error" style="display:none;"></div>
                </div>

                <div class="iframe-config-section iframe-html-section ${isUrlMode ? 'hidden' : ''}">
                    <div class="iframe-config-label">HTML Content
                        <textarea id="iframe-html-input" class="iframe-config-textarea" rows="6">${this._escapeHtml(this.config.html)}</textarea>
                    </div>
                </div>

                <div class="iframe-config-section">
                    <div class="iframe-config-label">Height (px)
                        <input type="number" id="iframe-height-input" class="iframe-config-input" value="${this.config.height}" min="100" max="2000" step="50">
                    </div>
                </div>

                <div class="iframe-config-section">
                    <div class="iframe-config-toggle">
                        <input type="checkbox" id="iframe-bordered-input" ${this.config.bordered !== false ? 'checked' : ''}>
                        <label for="iframe-bordered-input">Show border</label>
                    </div>
                </div>
            </div>
            <div class="iframe-config-footer">
                <button class="iframe-config-btn iframe-config-btn-secondary" id="iframe-config-cancel">Cancel</button>
                <button class="iframe-config-btn iframe-config-btn-primary" id="iframe-config-save">Save</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('open');
            modal.classList.add('open');
        });

        // Mode toggle
        const modeBtns = modal.querySelectorAll('.iframe-mode-btn');
        const urlSection = modal.querySelector('.iframe-url-section');
        const htmlSection = modal.querySelector('.iframe-html-section');
        let selectedMode = this.config.mode;

        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedMode = btn.dataset.mode;

                urlSection.classList.toggle('hidden', selectedMode !== 'url');
                htmlSection.classList.toggle('hidden', selectedMode !== 'html');

                // Clear error when switching modes
                const errorEl = modal.querySelector('#iframe-url-error');
                errorEl.style.display = 'none';
            });
        });

        // URL validation
        const urlInput = modal.querySelector('#iframe-url-input');
        const errorEl = modal.querySelector('#iframe-url-error');

        const validateUrl = (value) => {
            if (!value || value.trim() === '') {
                return { valid: true, message: '' }; // Empty is OK, will show empty state
            }
            try {
                const url = new URL(value.trim());
                if (url.protocol === 'http:' || url.protocol === 'https:') {
                    return { valid: true, message: '' };
                }
                return { valid: false, message: 'URL must start with http:// or https://' };
            } catch {
                return { valid: false, message: 'Please enter a valid URL (e.g., https://example.com)' };
            }
        };

        // Show error inline
        const showError = (message) => {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            urlInput.style.borderColor = 'var(--danger)';
        };

        const clearError = () => {
            errorEl.style.display = 'none';
            urlInput.style.borderColor = '';
        };

        // Validate on blur
        urlInput.addEventListener('blur', () => {
            const result = validateUrl(urlInput.value);
            if (!result.valid) {
                showError(result.message);
            } else {
                clearError();
            }
        });

        // Clear error on input
        urlInput.addEventListener('input', () => {
            clearError();
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
            // Validate URL if in URL mode
            if (selectedMode === 'url') {
                const urlValue = urlInput.value.trim();
                if (urlValue) {
                    const result = validateUrl(urlValue);
                    if (!result.valid) {
                        showError(result.message);
                        urlInput.focus();
                        return;
                    }
                }
            }

            const htmlValue = modal.querySelector('#iframe-html-input').value;
            const heightValue = parseInt(modal.querySelector('#iframe-height-input').value, 10) || 400;
            const borderedValue = modal.querySelector('#iframe-bordered-input').checked;

            const newConfig = {
                ...this.config,
                mode: selectedMode,
                url: selectedMode === 'url' ? urlInput.value.trim() : '',
                html: selectedMode === 'html' ? htmlValue : '',
                height: heightValue,
                bordered: borderedValue,
            };

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

            // Reload blocks
            await Blocks.load();
        };

        modal.querySelector('#iframe-config-save').addEventListener('click', save);
        modal.querySelector('.iframe-config-close').addEventListener('click', close);
        modal.querySelector('#iframe-config-cancel').addEventListener('click', close);
        overlay.addEventListener('click', close);

        // Keyboard
        const onKeydown = (e) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', onKeydown);
        this._iframeConfigKeydown = onKeydown;
    }

    /**
     * Check if a string is a valid URL.
     * @param {string} str
     * @returns {boolean}
     */
    _isValidUrl(str) {
        try {
            const url = new URL(str);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * Escape HTML to prevent XSS.
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Escape attribute value.
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    /**
     * Clean up resources.
     */
    destroy() {
        if (this._iframeConfigKeydown) {
            document.removeEventListener('keydown', this._iframeConfigKeydown);
            this._iframeConfigKeydown = null;
        }
        this._configModalOpen = false;
        super.destroy();
    }
}

// Register this block type
Block.register(IframeBlock.type(), IframeBlock);
