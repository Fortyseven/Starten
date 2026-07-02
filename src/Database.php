<?php
/**
 * Database — SQLite3 connection and query helpers.
 */

class Database
{
    private static ?SQLite3 $instance = null;

    public static function get(): SQLite3
    {
        if (self::$instance === null) {
            $path = $GLOBALS['db_path'] ?? __DIR__ . '/../data/startpage.db';
            $dir = dirname($path);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            self::$instance = new SQLite3($path);
            self::$instance->busyTimeout(5000);
            self::$instance->exec('PRAGMA journal_mode = WAL');
            self::$instance->exec('PRAGMA foreign_keys = ON');
        }
        return self::$instance;
    }

    /**
     * Execute a query and return all rows as associative arrays.
     */
    public static function all(string $sql, array $params = []): array
    {
        $db = self::get();
        $stmt = $db->prepare($sql);
        foreach ($params as $i => $val) {
            $stmt->bindValue($i + 1, $val, is_int($val) ? SQLITE3_INTEGER : SQLITE3_TEXT);
        }
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $rows[] = $row;
        }
        return $rows;
    }

    /**
     * Execute a query and return the first row.
     */
    public static function one(string $sql, array $params = []): ?array
    {
        $rows = self::all($sql, $params);
        return $rows[0] ?? null;
    }

    /**
     * Execute a query and return a single value.
     */
    public static function value(string $sql, array $params = []): mixed
    {
        $row = self::one($sql, $params);
        return $row ? reset($row) : null;
    }

    /**
     * Execute a statement (INSERT, UPDATE, DELETE).
     */
    public static function exec(string $sql, array $params = []): void
    {
        $db = self::get();
        $stmt = $db->prepare($sql);
        foreach ($params as $i => $val) {
            $stmt->bindValue($i + 1, $val, is_int($val) ? SQLITE3_INTEGER : SQLITE3_TEXT);
        }
        $stmt->execute();
    }

    /**
     * Get the last inserted row id.
     */
    public static function lastInsertId(): int
    {
        return self::get()->lastInsertRowID();
    }

    /**
     * Run a multi-statement SQL string (for migrations).
     */
    public static function execRaw(string $sql): void
    {
        self::get()->exec($sql);
    }
}
