<?php
/**
 * Exporter — Full layout → versioned JSON.
 *
 * Export format:
 * {
 *   "version": 1,
 *   "exported_at": "2025-01-01T00:00:00Z",
 *   "app": "Start Page Dashboard",
 *   "pages": [
 *     {
 *       "name": "General",
 *       "blocks": [
 *         {
 *           "type": "link_list",
 *           "title": "Development",
 *           "config": {},
 *           "items": [
 *             { "title": "GitHub", "url": "https://github.com", "data": {} }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

class Exporter
{
    /**
     * Export all pages, blocks, and items to a versioned JSON structure.
     */
    public function export(): array
    {
        $pages = Database::all('SELECT * FROM pages ORDER BY sort_order, id');

        $exportPages = [];
        foreach ($pages as $page) {
            $blocks = Database::all(
                'SELECT * FROM blocks WHERE page_id = ? ORDER BY sort_order, id',
                [$page['id']]
            );

            $exportBlocks = [];
            foreach ($blocks as $block) {
                $items = Database::all(
                    'SELECT * FROM block_items WHERE block_id = ? ORDER BY sort_order, id',
                    [$block['id']]
                );

                $exportItems = [];
                foreach ($items as $item) {
                    $exportItems[] = [
                        'title' => $item['title'],
                        'url' => $item['url'],
                        'data' => json_decode($item['data'] ?? '{}', true) ?? [],
                    ];
                }

                $exportBlocks[] = [
                    'type' => $block['type'],
                    'title' => $block['title'],
                    'config' => json_decode($block['config'] ?? '{}', true) ?? [],
                    'items' => $exportItems,
                ];
            }

            $exportPages[] = [
                'name' => $page['name'],
                'background' => json_decode($page['background'] ?? '{}', true) ?? [],
                'blocks' => $exportBlocks,
            ];
        }

        return [
            'version' => 1,
            'exported_at' => date('c'),
            'app' => 'Start Page Dashboard',
            'pages' => $exportPages,
        ];
    }
}
