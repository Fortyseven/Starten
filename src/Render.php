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
                        <button class="edit-mode-btn" title="Edit mode" aria-label="Edit mode">✎</button>
                        <button class="delete-block-btn" title="Delete block" aria-label="Delete block">×</button>
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
