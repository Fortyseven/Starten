<?php
/**
 * ItemsHandler — Block item (link) CRUD and reorder API endpoints.
 */

namespace Handlers;

class ItemsHandler
{
    public function add(): void
    {
        $input = $this->jsonInput();
        $blockId = (int) ($input['block_id'] ?? 0);
        $title = trim($input['title'] ?? '');
        $url = trim($input['url'] ?? '');

        if ($blockId <= 0) {
            apiError('block_id is required');
        }

        if ($title === '' && $url !== '') {
            $title = parse_url($url, PHP_URL_HOST) ?? basename($url);
        }

        $maxOrder = \Database::value(
            'SELECT MAX(sort_order) FROM block_items WHERE block_id = ?', [$blockId]
        ) ?? -1;

        \Database::exec(
            'INSERT INTO block_items (block_id, title, url, sort_order) VALUES (?, ?, ?, ?)',
            [$blockId, $title, $url === '' ? null : $url, $maxOrder + 1]
        );
        $id = \Database::lastInsertId();

        $item = \Database::one('SELECT * FROM block_items WHERE id = ?', [$id]);
        apiResponse(['item' => $item]);
    }

    public function update(): void
    {
        $input = $this->jsonInput();
        $id = (int) ($input['id'] ?? 0);
        if ($id <= 0) {
            apiError('Item id is required');
        }

        $updates = [];
        $params = [];

        if (isset($input['title'])) {
            $updates[] = 'title = ?';
            $params[] = trim($input['title']);
        }
        if (isset($input['url'])) {
            $updates[] = 'url = ?';
            $params[] = trim($input['url']) === '' ? null : trim($input['url']);
        }
        if (isset($input['data'])) {
            $updates[] = 'data = ?';
            $params[] = is_array($input['data']) ? json_encode($input['data']) : $input['data'];
        }

        if (empty($updates)) {
            apiError('No fields to update');
        }

        $params[] = $id;
        \Database::exec(
            'UPDATE block_items SET ' . implode(', ', $updates) . ' WHERE id = ?',
            $params
        );

        $item = \Database::one('SELECT * FROM block_items WHERE id = ?', [$id]);
        apiResponse(['item' => $item]);
    }

    public function delete(): void
    {
        $input = $this->jsonInput();
        $id = (int) ($input['id'] ?? 0);

        if ($id <= 0) {
            apiError('Item id is required');
        }

        \Database::exec('DELETE FROM block_items WHERE id = ?', [$id]);
        apiResponse(['success' => true]);
    }

    public function reorder(): void
    {
        $input = $this->jsonInput();
        $moves = $input['moves'] ?? [];

        if (empty($moves)) {
            apiError('moves array is required');
        }

        $db = \Database::get();
        $db->exec('BEGIN TRANSACTION');

        foreach ($moves as $move) {
            $id = (int) ($move['id'] ?? 0);
            $blockId = (int) ($move['block_id'] ?? 0);
            $sortOrder = (int) ($move['sort_order'] ?? 0);

            if ($id > 0 && $blockId > 0) {
                \Database::exec(
                    'UPDATE block_items SET block_id = ?, sort_order = ? WHERE id = ?',
                    [$blockId, $sortOrder, $id]
                );
            }
        }

        $db->exec('COMMIT');
        apiResponse(['success' => true]);
    }

    private function jsonInput(): array
    {
        $raw = file_get_contents('php://input');
        return json_decode($raw, true) ?? [];
    }
}
