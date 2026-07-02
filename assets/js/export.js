/**
 * export.js — Export/import UI and API calls.
 */

const Export = {
    init() {
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const importFile = document.getElementById('import-file');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.export());
        }

        if (importBtn) {
            importBtn.addEventListener('click', () => importFile.click());
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
    },

    export() {
        // Navigate to the export endpoint which triggers a download
        window.location.href = 'index.php?action=export:export';
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
                    headers: { 'Content-Type': 'application/json' },
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
