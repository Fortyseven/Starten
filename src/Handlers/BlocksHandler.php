<?php
/**
 * BlocksHandler — Block CRUD and reorder API endpoints.
 */

namespace Handlers;

class BlocksHandler
{
    public function get(): void
    {
        // Support both GET query param and POST body
        $input = $this->jsonInput();
        $pageId = (int) ($_GET['page_id'] ?? $input['page_id'] ?? 0);
        if ($pageId <= 0) {
            apiError('page_id is required');
        }

        $blocks = \Database::all(
            'SELECT * FROM blocks WHERE page_id = ? ORDER BY sort_order, id',
            [$pageId]
        );

        foreach ($blocks as &$block) {
            $blockId = $block['id'];
            $block['items'] = \Database::all(
                'SELECT * FROM block_items WHERE block_id = ? ORDER BY sort_order, id',
                [$blockId]
            );
        }

        apiResponse(['blocks' => $blocks]);
    }

    public function add(): void
    {
        $input = $this->jsonInput();
        $pageId = (int) ($input['page_id'] ?? 0);
        $title = trim($input['title'] ?? 'New Block');
        $type = trim($input['type'] ?? 'link_list');
        $config = isset($input['config'])
            ? (is_array($input['config']) ? json_encode($input['config']) : $input['config'])
            : '{}';

        if ($pageId <= 0) {
            apiError('page_id is required');
        }

        $maxOrder = \Database::value(
            'SELECT MAX(sort_order) FROM blocks WHERE page_id = ?', [$pageId]
        ) ?? -1;

        \Database::exec(
            'INSERT INTO blocks (page_id, type, title, config, sort_order) VALUES (?, ?, ?, ?, ?)',
            [$pageId, $type, $title, $config, $maxOrder + 1]
        );
        $id = \Database::lastInsertId();

        $block = \Database::one('SELECT * FROM blocks WHERE id = ?', [$id]);
        apiResponse(['block' => $block]);
    }

    public function update(): void
    {
        $input = $this->jsonInput();
        $id = (int) ($input['id'] ?? 0);
        if ($id <= 0) {
            apiError('Block id is required');
        }

        $updates = [];
        $params = [];

        if (isset($input['title'])) {
            $updates[] = 'title = ?';
            $params[] = trim($input['title']);
        }
        if (isset($input['type'])) {
            $updates[] = 'type = ?';
            $params[] = trim($input['type']);
        }
        if (isset($input['config'])) {
            $updates[] = 'config = ?';
            $params[] = is_array($input['config']) ? json_encode($input['config']) : $input['config'];
        }

        if (empty($updates)) {
            apiError('No fields to update');
        }

        $params[] = $id;
        \Database::exec(
            'UPDATE blocks SET ' . implode(', ', $updates) . ' WHERE id = ?',
            $params
        );

        $block = \Database::one('SELECT * FROM blocks WHERE id = ?', [$id]);
        apiResponse(['block' => $block]);
    }

    public function delete(): void
    {
        $input = $this->jsonInput();
        $id = (int) ($input['id'] ?? 0);

        if ($id <= 0) {
            apiError('Block id is required');
        }

        \Database::exec('DELETE FROM blocks WHERE id = ?', [$id]);
        apiResponse(['success' => true]);
    }

    public function reorder(): void
    {
        $input = $this->jsonInput();
        $pageId = (int) ($input['page_id'] ?? 0);
        $order = $input['order'] ?? [];

        if ($pageId <= 0 || empty($order)) {
            apiError('page_id and order array are required');
        }

        $db = \Database::get();
        $db->exec('BEGIN TRANSACTION');
        foreach ($order as $i => $blockId) {
            \Database::exec(
                'UPDATE blocks SET sort_order = ? WHERE id = ? AND page_id = ?',
                [$i, (int) $blockId, $pageId]
            );
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
