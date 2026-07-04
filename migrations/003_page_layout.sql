-- Migration 003: Add layout column to pages table
-- Stores page layout configuration as JSON:
--   { "columns": "auto" | 1 | 2 | 3 | 4 | 5 }

ALTER TABLE pages ADD COLUMN layout TEXT DEFAULT '{"columns":"auto"}';
