-- Migration 002: Add background column to pages table
-- Stores page background configuration as JSON:
--   { "type": "solid" | "gradient" | "image", "value": { ... } }

ALTER TABLE pages ADD COLUMN background TEXT DEFAULT '{}';
