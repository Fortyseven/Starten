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

    /**
     * List available backup files in data/backups/.
     */
    public function listBackups(): void
    {
        $backupDir = __DIR__ . '/../../data/backups';
        if (!is_dir($backupDir)) {
            apiResponse(['backups' => []]);
            return;
        }

        $files = glob($backupDir . '/startpage-*.json');
        if (!is_array($files) || empty($files)) {
            apiResponse(['backups' => []]);
            return;
        }

        // Sort newest first
        rsort($files);

        $backups = [];
        foreach ($files as $file) {
            $filename = basename($file);
            $stat = stat($file);
            $backups[] = [
                'filename' => $filename,
                'size' => $stat['size'],
                'created_at' => date('c', $stat['mtime']),
            ];
        }

        apiResponse(['backups' => $backups]);
    }

    /**
     * Restore from a specific backup file.
     */
    public function restoreBackup(): void
    {
        \Csrf::require();

        $raw = $this->jsonInput();
        $filename = isset($raw['filename']) ? trim($raw['filename']) : '';
        if ($filename === '') {
            apiError('Filename is required', 400);
        }

        // Validate filename to prevent path traversal
        $filename = basename($filename);
        if (!preg_match('/^startpage-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/', $filename)) {
            apiError('Invalid backup filename', 400);
        }

        $backupDir = __DIR__ . '/../../data/backups';
        $path = $backupDir . '/' . $filename;

        if (!file_exists($path)) {
            apiError('Backup file not found', 404);
        }

        $content = file_get_contents($path);
        $data = json_decode($content, true);
        if ($data === null) {
            apiError('Backup file is corrupted', 400);
        }

        $importer = new \Importer();
        $result = $importer->import($data);

        if (isset($result['error'])) {
            apiError($result['error'], 400);
        }

        apiResponse(['success' => true, 'message' => 'Restored from ' . $filename]);
    }

    /**
     * Download a specific backup file.
     */
    public function downloadBackup(): void
    {
        \Csrf::require();

        $raw = $this->jsonInput();
        $filename = isset($raw['filename']) ? trim($raw['filename']) : '';
        if ($filename === '') {
            apiError('Filename is required', 400);
        }

        // Validate filename to prevent path traversal
        $filename = basename($filename);
        if (!preg_match('/^startpage-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/', $filename)) {
            apiError('Invalid backup filename', 400);
        }

        $backupDir = __DIR__ . '/../../data/backups';
        $path = $backupDir . '/' . $filename;

        if (!file_exists($path)) {
            apiError('Backup file not found', 404);
        }

        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }

    /**
     * Create a manual backup (same as auto-backup but on-demand).
     */
    public function createBackup(): void
    {
        \Csrf::require();

        $backupDir = __DIR__ . '/../../data/backups';
        if (!is_dir($backupDir)) {
            mkdir($backupDir, 0755, true);
        }

        $exporter = new \Exporter();
        $data = $exporter->export();
        $timestamp = date('Y-m-d_H-i-s');
        $filename = "startpage-{$timestamp}.json";
        $path = $backupDir . '/' . $filename;

        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        // Prune old backups, keeping the newest 5
        $files = glob($backupDir . '/startpage-*.json');
        if (is_array($files)) {
            rsort($files);
            foreach (array_slice($files, 5) as $old) {
                @unlink($old);
            }
        }

        apiResponse(['success' => true, 'message' => 'Backup created']);
    }

    private function jsonInput(): array
    {
        $raw = file_get_contents('php://input');
        return json_decode($raw, true) ?? [];
    }
} 
