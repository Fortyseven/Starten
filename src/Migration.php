<?php
/**
 * Migration — Schema version tracking and migration runner.
 */

class Migration
{
    private string $migrationsDir;

    public function __construct(?string $migrationsDir = null)
    {
        $this->migrationsDir = $migrationsDir ?? __DIR__ . '/../migrations';
    }

    /**
     * Ensure the schema_migrations table exists.
     */
    private function ensureTable(): void
    {
        Database::execRaw("
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at DATETIME DEFAULT (datetime('now'))
            )
        ");
    }

    /**
     * Get the list of applied migration versions.
     */
    private function appliedVersions(): array
    {
        return Database::all('SELECT version FROM schema_migrations ORDER BY version');
    }

    /**
     * Get pending migration files (not yet applied).
     */
    private function pendingMigrations(): array
    {
        $applied = [];
        foreach ($this->appliedVersions() as $row) {
            $applied[] = (int) $row['version'];
        }

        $files = glob($this->migrationsDir . '/*.sql');
        sort($files);

        $pending = [];
        foreach ($files as $file) {
            $basename = basename($file, '.sql');
            $version = (int) $basename;
            if (!in_array($version, $applied, true)) {
                $pending[] = [
                    'version' => $version,
                    'file' => $file,
                ];
            }
        }
        return $pending;
    }

    /**
     * Run all pending migrations.
     */
    public function run(): void
    {
        $this->ensureTable();

        $pending = $this->pendingMigrations();
        foreach ($pending as $migration) {
            $sql = file_get_contents($migration['file']);
            Database::execRaw($sql);
            Database::exec(
                'INSERT INTO schema_migrations (version) VALUES (?)',
                [$migration['version']]
            );
        }
    }
}
