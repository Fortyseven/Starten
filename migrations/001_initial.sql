-- Migration 001: Initial schema
-- Creates pages, blocks, and block_items tables.

CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'link_list',
    title TEXT NOT NULL DEFAULT '',
    config TEXT DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS block_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    url TEXT DEFAULT NULL,
    data TEXT DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);

-- Seed data: default "General" page with sample blocks
INSERT INTO pages (name, sort_order) SELECT 'General', 0
WHERE NOT EXISTS (SELECT 1 FROM pages LIMIT 1);

-- Get the General page id for seeding
-- We use a trick: insert blocks linked to the first page if it's our seed
INSERT INTO blocks (page_id, type, title, sort_order)
SELECT p.id, 'link_list', 'Development', 0
FROM pages p
WHERE p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM blocks WHERE page_id = p.id AND title = 'Development')
  AND (SELECT COUNT(*) FROM pages) = 1;

INSERT INTO blocks (page_id, type, title, sort_order)
SELECT p.id, 'link_list', 'Design', 1
FROM pages p
WHERE p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM blocks WHERE page_id = p.id AND title = 'Design')
  AND (SELECT COUNT(*) FROM pages) = 1;

INSERT INTO blocks (page_id, type, title, sort_order)
SELECT p.id, 'link_list', 'Cloud Services', 2
FROM pages p
WHERE p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM blocks WHERE page_id = p.id AND title = 'Cloud Services')
  AND (SELECT COUNT(*) FROM pages) = 1;

-- Seed some sample links
INSERT INTO block_items (block_id, title, url, sort_order)
SELECT b.id, 'GitHub', 'https://github.com', 0
FROM blocks b JOIN pages p ON b.page_id = p.id
WHERE b.title = 'Development' AND p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM block_items WHERE block_id = b.id AND url = 'https://github.com')
  AND (SELECT COUNT(*) FROM pages) = 1;

INSERT INTO block_items (block_id, title, url, sort_order)
SELECT b.id, 'Stack Overflow', 'https://stackoverflow.com', 1
FROM blocks b JOIN pages p ON b.page_id = p.id
WHERE b.title = 'Development' AND p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM block_items WHERE block_id = b.id AND url = 'https://stackoverflow.com')
  AND (SELECT COUNT(*) FROM pages) = 1;

INSERT INTO block_items (block_id, title, url, sort_order)
SELECT b.id, 'MDN Web Docs', 'https://developer.mozilla.org', 2
FROM blocks b JOIN pages p ON b.page_id = p.id
WHERE b.title = 'Development' AND p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM block_items WHERE block_id = b.id AND url = 'https://developer.mozilla.org')
  AND (SELECT COUNT(*) FROM pages) = 1;

INSERT INTO block_items (block_id, title, url, sort_order)
SELECT b.id, 'Figma', 'https://figma.com', 0
FROM blocks b JOIN pages p ON b.page_id = p.id
WHERE b.title = 'Design' AND p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM block_items WHERE block_id = b.id AND url = 'https://figma.com')
  AND (SELECT COUNT(*) FROM pages) = 1;

INSERT INTO block_items (block_id, title, url, sort_order)
SELECT b.id, 'Dribbble', 'https://dribbble.com', 1
FROM blocks b JOIN pages p ON b.page_id = p.id
WHERE b.title = 'Design' AND p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM block_items WHERE block_id = b.id AND url = 'https://dribbble.com')
  AND (SELECT COUNT(*) FROM pages) = 1;

INSERT INTO block_items (block_id, title, url, sort_order)
SELECT b.id, 'AWS Console', 'https://aws.amazon.com', 0
FROM blocks b JOIN pages p ON b.page_id = p.id
WHERE b.title = 'Cloud Services' AND p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM block_items WHERE block_id = b.id AND url = 'https://aws.amazon.com')
  AND (SELECT COUNT(*) FROM pages) = 1;

INSERT INTO block_items (block_id, title, url, sort_order)
SELECT b.id, 'Vercel', 'https://vercel.com', 1
FROM blocks b JOIN pages p ON b.page_id = p.id
WHERE b.title = 'Cloud Services' AND p.name = 'General'
  AND NOT EXISTS (SELECT 1 FROM block_items WHERE block_id = b.id AND url = 'https://vercel.com')
  AND (SELECT COUNT(*) FROM pages) = 1;
