<?php
/**
 * ExportHandler — JSON export/import API endpoints.
 */

namespace Handlers;

class ExportHandler
{
    public function export(): void
    {
        $exporter = new \Exporter();
        $data = $exporter->export();

        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="startpage-export-' . date('Y-m-d') . '.json"');
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public function import(): void
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        if ($data === null) {
            apiError('Invalid JSON', 400);
        }

        $importer = new \Importer();
        $result = $importer->import($data);

        if (isset($result['error'])) {
            apiError($result['error'], 400);
        }

        apiResponse(['success' => true, 'message' => $result['message'] ?? 'Import complete']);
    }
}
