# AGENTS.md — Start Page Dashboard

## Project Overview

A single-page, single-user PHP + SQLite "start page" (speed dial / link dashboard) inspired by Start.me. Content blocks in a masonry grid, each containing categorized links with favicons. Fully inline-editable with instant auto-save. Access gated by IP whitelist.

**Stack:** PHP 8.3+ (no framework), SQLite3, vanilla JS/CSS (no dependencies), Google S2 favicons.

---

## File Structure & Responsibilities

```
config.php              — Server config: $allowed_ips, $db_path, $app_name
index.php               — Thin entry: loads config, autoloader, runs App
.gitignore              — Excludes data/ (SQLite DB)

src/
  App.php               — Bootstrap: migrations → middleware → router
  Router.php            — Routes ?action=handler:subaction to handler classes
  Database.php          — SQLite3 singleton, all()/one()/value()/exec() helpers
  Migration.php         — Reads schema_migrations table, applies pending .sql files
  Middleware.php        — IP whitelist check (exits with 403 on failure)
  Render.php            — HTML shell output (header, main, templates, scripts)
  Exporter.php          — Queries all pages→blocks→items → versioned JSON array
  Importer.php          — Validates JSON version, clears DB, restores data

src/Handlers/
  PagesHandler.php      — pages:get, pages:add, pages:rename, pages:delete, pages:reorder
  BlocksHandler.php     — blocks:get, blocks:add, blocks:update, blocks:delete, blocks:reorder
  ItemsHandler.php      — items:add, items:update, items:delete, items:reorder
  ExportHandler.php     — export:export (file download), export:import (JSON POST)

migrations/
  001_initial.sql       — Creates schema_migrations, pages, blocks, block_items + seed data

assets/css/
  theme.css             — CSS custom properties for light/dark themes
  style.css             — Layout, masonry, blocks, items, edit mode, drag states

assets/js/
  app.js                — AppState object, api() helper, faviconUrl(), debounce()
  tabs.js               — Page tab rendering, add/rename/delete/select
  blocks.js             — Block cards, drag-to-reorder blocks, inline rename
  items.js              — Link rows, drag-to-reorder/move items, add form, delete
  export.js             — Export download, import file picker → POST → reload
  theme.js              — Theme toggle, localStorage persistence
```

---

## Database Schema

```sql
-- Migration tracking
schema_migrations (version INTEGER PK, applied_at DATETIME)

-- Page collections (tabs at top)
pages (id INTEGER PK, name TEXT, sort_order INTEGER, created_at DATETIME)

-- Generic block containers (type + config JSON for extensibility)
blocks (
  id INTEGER PK,
  page_id INTEGER FK → pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'link_list',   -- 'link_list', 'iframe', 'weather', etc.
  title TEXT NOT NULL DEFAULT '',
  config TEXT DEFAULT '{}',                 -- JSON: type-specific settings
  sort_order INTEGER,
  created_at DATETIME
)

-- Flexible items within blocks (works for links, bookmarks, forecast rows, etc.)
block_items (
  id INTEGER PK,
  block_id INTEGER FK → blocks(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  url TEXT,                                 -- nullable for non-link types
  data TEXT DEFAULT '{}',                   -- JSON: flexible extra fields
  sort_order INTEGER
)
```

**Design rationale:** The `type` + `config` + `data` JSON columns make the schema generic. Adding a new block type (e.g., weather, iframe) requires no schema changes — just a new handler method and frontend renderer.

---

## API Convention

All API requests POST to `index.php?action=handler:subaction` with JSON body.

**Action format:** `handler:subaction`

- Handlers: `pages`, `blocks`, `items`, `export`
- Subactions: `get`, `add`, `update`, `delete`, `reorder`, `rename`

**Response format:** JSON, always exits via `apiResponse()` or `apiError()`.

```json
{"success": true}
{"page": {"id": 1, "name": "General", ...}}
{"blocks": [...]}
{"error": "page_id is required"}
```

**Special endpoints:**

- `export:export` — Returns JSON with `Content-Disposition: attachment` (triggers download)
- `export:import` — Accepts JSON POST, validates version, clears & restores data

**Note:** `blocks:get` reads `page_id` from both `$_GET` and POST body for flexibility.

---

## Frontend Architecture

### AppState (shared state in app.js)

```js
const AppState = {
    currentPageId: null, // Currently active page
    pages: [], // All pages
    blocks: [], // Blocks for current page (with nested items)
    editModeBlockId: null, // Block currently in edit mode
};
```

### api() helper (app.js)

```js
async function api(action, data = {}) {
    // POST to index.php?action=XXX with JSON body
    // Returns parsed JSON or null on error
}
```

### Module initialization order (app.js DOMContentLoaded)

1. `Theme.init()` — Apply saved theme
2. `Tabs.init()` — Load pages, select first, load blocks

### Key interaction patterns

- **Inline rename:** Double-click title → `contenteditable` → save on blur/enter, debounce on input
- **Add link:** `+` button → inline form (URL + title inputs) → save on ✓/enter, cancel on ×/escape
- **Edit mode:** ✎ button toggles per-block edit mode (shows drag handles, delete buttons)
- **Block drag:** Native HTML5 DnD on `.block` element, reorder via `blocks:reorder` API
- **Item drag:** Native HTML5 DnD on `.block-item`, move/reorder via `items:reorder` API
- **All changes auto-save:** Every mutation immediately POSTs to API, then reloads blocks

---

## Adding New Features

### New block type (e.g., weather)

1. Schema: No changes needed (uses existing `type`, `config`, `data` columns)
2. Add migration if new columns needed: `migrations/002_weather.sql`
3. Add handler methods in `src/Handlers/BlocksHandler.php` or new handler
4. Add frontend renderer in `assets/js/blocks.js` (check `block.type` for rendering)
5. Update `Exporter.php` if export format needs extension

### New API endpoint

1. Add method to appropriate handler in `src/Handlers/`
2. Method receives JSON input via `$this->jsonInput()`
3. Use `\Database::all()`, `\Database::exec()`, etc. (note backslash for global namespace)
4. Return via `apiResponse()` or `apiError()`
5. Call from frontend: `await api('handler:method', { data })`

### New JS module

1. Create file in `assets/js/`
2. Add `<script>` tag in `src/Render.php` (order matters — app.js first)
3. Initialize in `app.js` DOMContentLoaded or self-initialize
4. Use `api()`, `AppState`, `debounce()`, `faviconUrl()` from app.js

### Schema migration

1. Create `migrations/NNN_description.sql` (numbered sequentially)
2. Use `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE`
3. Migration auto-runs on next page load (Migration.php checks schema_migrations table)

---

## Configuration

Edit `config.php`:

```php
$allowed_ips = ['127.0.0.1', '::1', '192.168.1.5'];  // Exact IP match
$db_path = __DIR__ . '/data/startpage.db';           // SQLite file path
$app_name = 'My Start Page';                          // Page title
```

---

## Testing

```bash
# Start dev server
php -S 127.0.0.1:8080 -t .

# Test API endpoints (from CLI)
php -r "
\$_GET = ['action' => 'pages:get'];
\$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require 'config.php';
spl_autoload_register(function (\$c) { require __DIR__.'/src/'.str_replace('\\\\','/',\$c).'.php'; });
(new App())->run();
"

# Test IP gating
# Change REMOTE_ADDR to non-whitelisted IP → should get 403
```

---

## Known Limitations & Notes

- **No auth beyond IP whitelist** — Password auth can be added as middleware
- **No search bar** — Can be added as a top-bar component or block type
- **Single-user** — No user accounts, shared state
- **SQLite file locking** — WAL mode enabled; concurrent writes handled by busy_timeout
- **Export format versioning** — Current version: 1. Importer rejects unknown versions but ignores unknown fields (forward-compatible)
- **No CSRF protection** — Single-user app; add if exposing publicly
- **PHP autoloader** — Simple prefix-based; no PSR-4, no Composer

---

## Quick Reference

| Task                     | How                                                                        |
| ------------------------ | -------------------------------------------------------------------------- |
| Add a page               | `api('pages:add', { name: 'Work' })`                                       |
| Rename a page            | Double-click tab name                                                      |
| Add a block              | `api('blocks:add', { page_id: 1, title: 'Tools', type: 'link_list' })`     |
| Add a link               | `api('items:add', { block_id: 5, url: 'https://...', title: 'Name' })`     |
| Reorder blocks           | `api('blocks:reorder', { page_id: 1, order: [1, 3, 2] })`                  |
| Move item between blocks | `api('items:reorder', { moves: [{ id: 7, block_id: 3, sort_order: 0 }] })` |
| Export layout            | `api('export:export')` → file download                                     |
| Import layout            | `api('export:import', { version: 1, pages: [...] })`                       |
| Run migration            | Auto-runs on page load; add file to `migrations/`                          |
