# Starten

A lightweight, self-hosted start page dashboard — your personal speed dial and link hub.

Organize bookmarks into pages and blocks, drag to reorder, and customize with light/dark themes and backgrounds. Zero dependencies, zero framework overhead.

## Features

- **Page tabs** — multiple collections of blocks, like browser tabs
- **Masonry grid** — responsive block layout that adapts to any screen size
- **Inline editing** — rename blocks, add/remove links, all without leaving the page
- **Drag & drop** — reorder blocks and items, move items between blocks
- **Light/dark themes** — toggle with persistence via localStorage
- **Custom backgrounds** — solid color, gradient, or image with live preview
- **Export/import** — backup your layout as JSON and restore it anywhere
- **IP whitelist** — simple access control (no accounts needed)
- **Auto-save** — every change is saved immediately

## Tech Stack

- **PHP 8.3+** (no framework, no Composer)
- **SQLite3** (single-file database, WAL mode)
- **Vanilla JS/CSS** (zero dependencies)
- **Google S2 Favicons** (automatic favicon fetching)

## Quick Start

### 1. Deploy

Place the project files on any PHP-capable web server (Apache, Nginx, Caddy, etc.) pointing to this directory as the document root.

### 2. Configure

Edit `config.php`:

```php
// Add your IP addresses
$allowed_ips = ['127.0.0.1', '::1', '192.168.1.50'];

// Database path (auto-created on first visit)
$db_path = __DIR__ . '/data/startpage.db';

// Page title
$app_name = 'My Start Page';
```

### 3. Set Permissions

Ensure the web server can write to the `data/` directory:

```bash
mkdir -p data
chmod 755 data
```

### 4. Visit

Open `http://your-server/index.php` in your browser. The initial migration runs automatically on first load, creating a default "General" page with sample blocks.

## Development

Run the built-in PHP server:

```bash
php -S 127.0.0.1:8080 -t .
```

Then visit `http://127.0.0.1:8080`.

## API

See [API.md](API.md) for the full endpoint reference.

## Database Schema

```
pages (id, name, sort_order, created_at)
blocks (id, page_id, type, title, config, sort_order, created_at)
block_items (id, block_id, title, url, data, sort_order)
```

The `type`, `config` (JSON), and `data` (JSON) columns are extensible — new block types (weather, iframe, notes, etc.) can be added without schema changes.

## Known Limitations

- **No user authentication** beyond IP whitelist
- **Single-user** — shared state, no accounts
- **CSRF protection** via double-submit cookie pattern (SameSite=Strict)
- **No search** — can be added as a future feature

## License

MIT
