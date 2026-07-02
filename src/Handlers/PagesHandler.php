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
        \Database::exec('INSERT INTO pages (name, sort_order) VALUES (?, ?)', [$name, $maxOrder + 1]);
        $id = \Database::lastInsertId();

        $page = \Database::one('SELECT * FROM pages WHERE id = ?', [$id]);
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
