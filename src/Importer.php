<?php
/**
 * Importer — JSON → layout restore with validation.
 *
 * Forward-compatible: unknown fields in the JSON are silently ignored.
 * Required fields are validated. Schema evolution won't break old exports.
 */

class Importer
{
    private const SUPPORTED_VERSIONS = [1];

    /**
     * Maximum number of backup files to retain.
     */
    private const MAX_BACKUPS = 5;

    /**
     * Import layout from JSON data.
     *
     * Creates an auto-backup before clearing, then restores from the import.
     */
    public function import(array $data): array
    {
        // Validate version
        $version = (int) ($data['version'] ?? 0);
        if (!in_array($version, self::SUPPORTED_VERSIONS, true)) {
            return ['error' => "Unsupported export version: {$version}. Supported: " . implode(', ', self::SUPPORTED_VERSIONS)];
        }

        $pages = $data['pages'] ?? [];
        if (!is_array($pages)) {
            return ['error' => 'Missing or invalid "pages" array'];
        }

        // Create auto-backup before clearing
        $this->createBackup();

        $db = Database::get();
        $db->exec('BEGIN TRANSACTION');

        try {
            // Clear existing data (cascade handles blocks → items)
            Database::execRaw('DELETE FROM pages');
            Database::execRaw('DELETE FROM blocks');
            Database::execRaw('DELETE FROM block_items');

            // Reset auto-increment counters
            Database::execRaw("DELETE FROM sqlite_sequence WHERE name IN ('pages', 'blocks', 'block_items')");

            $pageOrder = 0;
            foreach ($pages as $pageData) {
                $name = trim($pageData['name'] ?? 'Imported Page');
                if ($name === '') {
                    $name = 'Imported Page';
                }

                $background = $pageData['background'] ?? [];
                $backgroundJson = is_array($background) ? json_encode($background) : '{}';

                $layout = $pageData['layout'] ?? null;
                $layoutJson = $layout !== null ? (is_array($layout) ? json_encode($layout) : $layout) : null;

                Database::exec(
                    'INSERT INTO pages (name, sort_order, background, layout) VALUES (?, ?, ?, ?)',
                    [$name, $pageOrder, $backgroundJson, $layoutJson]
                );
                $pageId = Database::lastInsertId();

                $blockOrder = 0;
                $blocks = $pageData['blocks'] ?? [];
                foreach ($blocks as $blockData) {
                    $type = trim($blockData['type'] ?? 'link_list');
                    $title = trim($blockData['title'] ?? 'Imported Block');
                    $config = $blockData['config'] ?? [];
                    $configJson = is_array($config) ? json_encode($config) : '{}';

                    Database::exec(
                        'INSERT INTO blocks (page_id, type, title, config, sort_order) VALUES (?, ?, ?, ?, ?)',
                        [$pageId, $type, $title, $configJson, $blockOrder]
                    );
                    $blockId = Database::lastInsertId();

                    $itemOrder = 0;
                    $items = $blockData['items'] ?? [];
                    foreach ($items as $itemData) {
                        $itemTitle = trim($itemData['title'] ?? '');
                        $itemUrl = isset($itemData['url']) ? trim($itemData['url']) : null;
                        $itemDataExtra = $itemData['data'] ?? [];
                        $itemDataJson = is_array($itemDataExtra) ? json_encode($itemDataExtra) : '{}';

                        Database::exec(
                            'INSERT INTO block_items (block_id, title, url, data, sort_order) VALUES (?, ?, ?, ?, ?)',
                            [$blockId, $itemTitle, $itemUrl, $itemDataJson, $itemOrder]
                        );
                        $itemOrder++;
                    }

                    $blockOrder++;
                }

                $pageOrder++;
            }

            $db->exec('COMMIT');

            return [
                'success' => true,
                'message' => "Imported {$pageOrder} page(s) with blocks and items.",
            ];

        } catch (\Exception $e) {
            $db->exec('ROLLBACK');
            return ['error' => 'Import failed: ' . $e->getMessage()];
        }
    }

    /**
     * Export current state to data/backups/ before import clears it.
     * Keeps a rolling window of the last MAX_BACKUPS backups.
     */
    private function createBackup(): void
    {
        $backupDir = __DIR__ . '/../data/backups';
        if (!is_dir($backupDir)) {
            mkdir($backupDir, 0755, true);
        }

        $exporter = new \Exporter();
        $data = $exporter->export();
        $timestamp = date('Y-m-d_H-i-s');
        $filename = "startpage-{$timestamp}.json";
        $path = $backupDir . '/' . $filename;

        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        // Prune old backups, keeping the newest MAX_BACKUPS
        $files = glob($backupDir . '/startpage-*.json');
        if (is_array($files)) {
            // Sort newest first
            rsort($files);
            foreach (array_slice($files, self::MAX_BACKUPS) as $old) {
                @unlink($old);
            }
        }
    }
}
