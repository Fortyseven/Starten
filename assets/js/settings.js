/**
 * settings.js — Settings modal: open/close, tab switching, backup management.
 */

const Settings = {
    /**
     * Initialize event listeners for the settings modal.
     */
    init() {
        const settingsBtn = document.getElementById('settings-btn');
        const settingsModal = document.getElementById('settings-modal');
        const settingsOverlay = document.getElementById('settings-overlay');
        const closeBtn = document.getElementById('settings-close');
        const tabs = document.querySelectorAll('.settings-tab');
        const themeToggle = document.getElementById('settings-theme-toggle');
        const createBackupBtn = document.getElementById('settings-create-backup');
        const exportBtn = document.getElementById('settings-export-btn');
        const importBtn = document.getElementById('settings-import-btn');
        const importFile = document.getElementById('import-file');

        // Kebab menu elements
        const menuBtn = document.getElementById('system-menu-btn');
        const dropdown = document.getElementById('system-menu-dropdown');

        // Toggle kebab dropdown on menu button click
        if (menuBtn && dropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && e.target !== menuBtn) {
                    this.closeMenu();
                }
            });
        }

        // Open modal from kebab menu
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.open();
                // Close the kebab dropdown
                if (dropdown) dropdown.classList.remove('open');
                if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
            });
        }

        // Close modal
        const close = () => this.close();
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (settingsOverlay) settingsOverlay.addEventListener('click', close);

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && settingsModal.classList.contains('open')) {
                close();
            }
        });

        // Tab switching
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Theme toggle in General tab
        if (themeToggle) {
            themeToggle.addEventListener('click', () => Theme.toggle());
        }

        // Create backup
        if (createBackupBtn) {
            createBackupBtn.addEventListener('click', () => this.createBackup());
        }

        // Export JSON
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.export());
        }

        // Import JSON
        if (importBtn) {
            importBtn.addEventListener('click', () => importFile.click());
        }

        if (importFile) {
            importFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.import(file);
                    importFile.value = '';
                }
            });
        }

        // Load backup list when switching to backups tab
        this._backupContentLoaded = false;
    },

    /**
     * Toggle the kebab dropdown menu.
     */
    toggleMenu() {
        const dropdown = document.getElementById('system-menu-dropdown');
        const menuBtn = document.getElementById('system-menu-btn');
        if (!dropdown || !menuBtn) return;

        const isOpen = dropdown.classList.contains('open');
        if (isOpen) {
            this.closeMenu();
        } else {
            dropdown.classList.add('open');
            menuBtn.setAttribute('aria-expanded', 'true');
        }
    },

    /**
     * Close the kebab dropdown menu.
     */
    closeMenu() {
        const dropdown = document.getElementById('system-menu-dropdown');
        const menuBtn = document.getElementById('system-menu-btn');
        if (dropdown) dropdown.classList.remove('open');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    },

    /**
     * Open the settings modal.
     */
    open() {
        const modal = document.getElementById('settings-modal');
        const overlay = document.getElementById('settings-overlay');
        if (modal) modal.classList.add('open');
        if (overlay) overlay.classList.add('open');
    },

    /**
     * Close the settings modal.
     */
    close() {
        const modal = document.getElementById('settings-modal');
        const overlay = document.getElementById('settings-overlay');
        if (modal) modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    },

    /**
     * Switch to a tab by name.
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.settings-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update panels
        document.querySelectorAll('.settings-panel').forEach((panel) => {
            panel.classList.toggle('active', panel.dataset.tab === tabName);
        });

        // Load backup list when switching to backups tab (lazy load)
        if (tabName === 'backups' && !this._backupContentLoaded) {
            this.loadBackups();
            this._backupContentLoaded = true;
        }
    },

    /**
     * Fetch and render the list of backups.
     */
    async loadBackups() {
        const listEl = document.getElementById('backups-list');
        if (!listEl) return;

        listEl.innerHTML = '<div class="loading">Loading backups...</div>';

        const result = await api('backups:listBackups');
        if (!result || !result.backups) {
            listEl.innerHTML = '<div class="backups-empty">No backups found.</div>';
            return;
        }

        const backups = result.backups;
        if (backups.length === 0) {
            listEl.innerHTML = '<div class="backups-empty">No backups yet. Create one or import a JSON file.</div>';
            return;
        }

        listEl.innerHTML = '';
        backups.forEach((backup) => {
            const item = document.createElement('div');
            item.className = 'backup-item';

            const date = new Date(backup.created_at);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            const sizeStr = this.formatSize(backup.size);

            item.innerHTML = `
                <div class="backup-info">
                    <div class="backup-filename" title="${backup.filename}">${backup.filename}</div>
                    <div class="backup-meta">${dateStr} &middot; ${sizeStr}</div>
                </div>
                <div class="backup-actions">
                    <button class="backup-download-btn" data-filename="${backup.filename}" title="Download">⬇</button>
                    <button class="backup-restore-btn" data-filename="${backup.filename}">Restore</button>
                </div>
            `;

            listEl.appendChild(item);
        });

        // Attach restore handlers
        listEl.querySelectorAll('.backup-restore-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.restoreBackup(btn.dataset.filename);
            });
        });

        // Attach download handlers
        listEl.querySelectorAll('.backup-download-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.downloadBackup(btn.dataset.filename);
            });
        });
    },

    /**
     * Create a manual backup.
     */
    async createBackup() {
        const result = await api('backups:createBackup');
        if (result && result.error) {
            alert('Backup failed: ' + result.error);
            return;
        }
        // Refresh the backup list
        this._backupContentLoaded = false;
        this.loadBackups();
    },

    /**
     * Restore from a backup file.
     */
    async restoreBackup(filename) {
        if (!confirm(`Restore from ${filename}?\n\nThis will replace your current layout. An auto-backup of your current state will be created first.`)) {
            return;
        }

        const result = await api('backups:restoreBackup', { filename });
        if (result && result.error) {
            alert('Restore failed: ' + result.error);
            return;
        }

        alert(result?.message || 'Restore complete!');
        location.reload();
    },

    /**
     * Download a specific backup file.
     */
    async downloadBackup(filename) {
        try {
            const response = await fetch('index.php?action=backups:downloadBackup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken(),
                },
                body: JSON.stringify({ filename }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: response.statusText }));
                alert('Download failed: ' + err.error);
                return;
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Download failed: ' + e.message);
        }
    },

    /**
     * Export layout as JSON download.
     */
    async export() {
        try {
            const response = await fetch('index.php?action=export:export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken(),
                },
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: response.statusText }));
                alert('Export failed: ' + err.error);
                return;
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'startpage-export-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Export failed: ' + e.message);
        }
    },

    /**
     * Import layout from a JSON file.
     */
    async import(file) {
        if (!file.name.endsWith('.json')) {
            alert('Please select a JSON file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);

                const response = await fetch('index.php?action=export:import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken(),
                    },
                    body: JSON.stringify(json),
                });

                const result = await response.json();

                if (result.error) {
                    alert('Import failed: ' + result.error);
                    return;
                }

                alert(result.message || 'Import complete!');
                location.reload();
            } catch (err) {
                alert('Failed to parse file: ' + err.message);
            }
        };
        reader.readAsText(file);
    },

    /**
     * Format file size for display.
     */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => Settings.init());
