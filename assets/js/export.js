/**
 * export.js — Export/import UI and API calls.
 */

const Export = {
    init() {
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const importFile = document.getElementById('import-file');
        const menuBtn = document.getElementById('system-menu-btn');
        const dropdown = document.getElementById('system-menu-dropdown');

        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeMenu();
                this.export();
            });
        }

        if (importBtn) {
            importBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeMenu();
                importFile.click();
            });
        }

        if (importFile) {
            importFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.import(file);
                    importFile.value = ''; // Reset for re-import
                }
            });
        }

        // Toggle dropdown on kebab button click
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

            // Close on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeMenu();
                }
            });
        }
    },

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

    closeMenu() {
        const dropdown = document.getElementById('system-menu-dropdown');
        const menuBtn = document.getElementById('system-menu-btn');
        if (dropdown) dropdown.classList.remove('open');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    },

    async export() {
        // POST with CSRF header, then trigger download via blob URL
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
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => Export.init());
