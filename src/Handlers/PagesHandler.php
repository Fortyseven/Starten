<?php
/**
 * PagesHandler — Page CRUD API endpoints.
 */

namespace Handlers;

class PagesHandler
{
    public function get(): void
    {
        $pages = \Database::all('SELECT * FROM pages ORDER BY sort_order, id');
        apiResponse(['pages' => $pages]);
    }

    public function add(): void
    {
        $input = $this->jsonInput();
        $name = trim($input['name'] ?? 'New Page');
        if ($name === '') {
            apiError('Page name is required');
        }

        $maxOrder = \Database::value('SELECT MAX(sort_order) FROM pages') ?? -1;
        $background = isset($input['background']) ? json_encode($input['background']) : '{}';
        \Database::exec('INSERT INTO pages (name, sort_order, background) VALUES (?, ?, ?)', [$name, $maxOrder + 1, $background]);
        $id = \Database::lastInsertId();

        $page = \Database::one('SELECT * FROM pages WHERE id = ?', [$id]);
        apiResponse(['page' => $page]);
    }

    public function update(): void
    {
        $input = $this->jsonInput();
        $id = (int) ($input['id'] ?? 0);

        if ($id <= 0) {
            apiError('Page id is required');
        }

        // Allow updating background
        if (isset($input['background'])) {
            $background = json_encode($input['background']);
            \Database::exec('UPDATE pages SET background = ? WHERE id = ?', [$background, $id]);
        }

        $page = \Database::one('SELECT * FROM pages WHERE id = ?', [$id]);
        if ($page === false) {
            apiError('Page not found', 404);
        }

        apiResponse(['page' => $page]);
    }

    public function rename(): void
    {
        $input = $this->jsonInput();
        $id = (int) ($input['id'] ?? 0);
        $name = trim($input['name'] ?? '');

        if ($id <= 0 || $name === '') {
            apiError('Page id and name are required');
        }

        \Database::exec('UPDATE pages SET name = ? WHERE id = ?', [$name, $id]);
        $page = \Database::one('SELECT * FROM pages WHERE id = ?', [$id]);
        apiResponse(['page' => $page]);
    }

    public function delete(): void
    {
        $input = $this->jsonInput();
        $id = (int) ($input['id'] ?? 0);

        if ($id <= 0) {
            apiError('Page id is required');
        }

        \Database::exec('DELETE FROM pages WHERE id = ?', [$id]);
        apiResponse(['success' => true]);
    }

    public function reorder(): void
    {
        $input = $this->jsonInput();
        $order = $input['order'] ?? [];

        if (empty($order)) {
            apiError('Order array is required');
        }

        $db = \Database::get();
        $db->exec('BEGIN TRANSACTION');
        foreach ($order as $i => $pageId) {
            \Database::exec('UPDATE pages SET sort_order = ? WHERE id = ?', [$i, (int) $pageId]);
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
