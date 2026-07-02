<?php
/**
 * Render — HTML page rendering.
 */

class Render
{
    /**
     * Render the full HTML page.
     */
    public function page(): void
    {
        $appName = $GLOBALS['app_name'] ?? 'Start Page';

        echo <<<HTML
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$appName}</title>
    <link rel="stylesheet" href="assets/css/theme.css">
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
    <div id="app">
        <!-- Top bar: page tabs + controls -->
        <header id="topbar">
            <div id="tabs-container">
                <nav id="tabs"></nav>
                <button id="add-page-btn" title="Add page" aria-label="Add page">+</button>
            </div>
            <button id="add-block-btn" title="Add block" aria-label="Add block">+ Block</button>
            <div id="topbar-controls">
                <button id="theme-toggle" title="Toggle theme" aria-label="Toggle theme">
                    <span class="theme-icon-light">🌙</span>
                    <span class="theme-icon-dark">☀️</span>
                </button>
                <div id="system-menu" class="dropdown">
                    <button id="system-menu-btn" title="Menu" aria-label="Menu" aria-haspopup="true" aria-expanded="false">⋮</button>
                    <div id="system-menu-dropdown" class="dropdown-menu" role="menu">
                        <button id="export-btn" role="menuitem" title="Export layout">⬇ Export</button>
                        <button id="import-btn" role="menuitem" title="Import layout">⬆ Import</button>
                    </div>
                </div>
                <input type="file" id="import-file" accept=".json" hidden>
            </div>
        </header>

        <!-- Main content: masonry grid of blocks -->
        <main id="blocks-container"></main>

        <!-- Block template (hidden, cloned by JS) -->
        <template id="block-template">
            <div class="block" draggable="true">
                <div class="block-header">
                    <span class="block-drag-handle" title="Drag to reorder">⠿</span>
                    <h2 class="block-title"></h2>
                    <div class="block-actions">
                        <button class="add-item-btn" title="Add link" aria-label="Add link">+</button>
                        <button class="block-kebab" title="Block actions" aria-label="Block actions" aria-haspopup="true" aria-expanded="false">⋮</button>
                        <div class="block-dropdown" role="menu">
                            <button class="block-dropdown-item" role="menuitem">✏️ Rename</button>
                            <button class="block-dropdown-item" role="menuitem">✎ Edit mode</button>
                            <button class="block-dropdown-item block-dropdown-item-danger" role="menuitem">🗑 Delete block</button>
                        </div>
                    </div>
                </div>
                <div class="block-items"></div>
            </div>
        </template>

        <!-- Item template (hidden, cloned by JS) -->
        <template id="item-template">
            <a class="block-item" draggable="true" href="#" target="_blank" rel="noopener">
                <span class="item-drag-handle" title="Drag to reorder">⠿</span>
                <img class="item-favicon" src="" alt="" width="16" height="16">
                <span class="item-title"></span>
                <button class="delete-item-btn" title="Remove" aria-label="Remove">×</button>
            </a>
        </template>

        <!-- Add item form template -->
        <template id="add-item-form">
            <div class="add-item-form">
                <input type="text" class="item-url-input" placeholder="https://example.com" autofocus>
                <input type="text" class="item-title-input" placeholder="Title (optional)">
                <div class="add-item-actions">
                    <button class="save-item-btn">✓</button>
                    <button class="cancel-item-btn">×</button>
                </div>
            </div>
        </template>

        <!-- Background editor slide-in panel -->
        <div id="bg-panel-overlay" class="bg-panel-overlay bg-hidden"></div>
        <aside id="bg-panel" class="bg-panel bg-hidden">
            <div class="bg-panel-header">
                <h2>Page Background</h2>
                <button id="bg-panel-close" class="bg-panel-close" aria-label="Close">×</button>
            </div>
            <div class="bg-panel-body">
                <!-- Mode selector -->
                <div class="bg-mode-tabs">
                    <button class="bg-mode-tab active" data-mode="solid">Solid</button>
                    <button class="bg-mode-tab" data-mode="gradient">Gradient</button>
                    <button class="bg-mode-tab" data-mode="image">Image</button>
                </div>

                <!-- Solid color -->
                <div class="bg-mode-panel active" data-mode="solid">
                    <label class="bg-label">Color
                        <input type="color" id="bg-solid-color" value="#4361ee">
                    </label>
                </div>

                <!-- Gradient -->
                <div class="bg-mode-panel" data-mode="gradient">
                    <label class="bg-label">Start Color
                        <input type="color" id="bg-gradient-start" value="#4361ee">
                    </label>
                    <label class="bg-label">Stop Color
                        <input type="color" id="bg-gradient-stop" value="#f72585">
                    </label>
                    <label class="bg-label">Angle
                        <input type="range" id="bg-gradient-angle" min="0" max="360" value="135">
                        <span id="bg-gradient-angle-value">135°</span>
                    </label>
                </div>

                <!-- Image -->
                <div class="bg-mode-panel" data-mode="image">
                    <label class="bg-label">Image URL
                        <input type="text" id="bg-image-url" placeholder="https://example.com/image.jpg">
                    </label>
                    <label class="bg-label bg-file-label">
                        <span>Or upload an image</span>
                        <input type="file" id="bg-image-upload" accept="image/*" hidden>
                    </label>
                    <div id="bg-image-preview" class="bg-preview bg-hidden"></div>
                </div>

                <!-- Live preview -->
                <div class="bg-label">Preview
                    <div id="bg-preview-area" class="bg-preview-area"></div>
                </div>
            </div>
            <div class="bg-panel-footer">
                <button id="bg-panel-cancel" class="bg-btn bg-btn-secondary">Cancel</button>
                <button id="bg-panel-save" class="bg-btn bg-btn-primary">Save</button>
            </div>
        </aside>
    </div>

    <script src="assets/js/app.js"></script>
    <script src="assets/js/theme.js"></script>
    <script src="assets/js/tabs.js"></script>
    <script src="assets/js/blocks.js"></script>
    <script src="assets/js/items.js"></script>
    <script src="assets/js/export.js"></script>
</body>
</html>
HTML;
        exit;
    }
}
