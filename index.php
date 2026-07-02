<?php
/**
 * Start Page Dashboard — Entry Point
 *
 * Thin bootstrap: load config, initialize app, dispatch request.
 */

// Load .env (if present) into server environment
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line && $line[0] !== '#') {
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                putenv(trim($key) . '=' . trim($value));
            }
        }
    }
}

// Load configuration
require_once __DIR__ . '/config.php';

// Autoloader for src/ classes
spl_autoload_register(function ($class) {
    $prefix = '';
    $baseDir = __DIR__ . '/src/';

    $file = $baseDir . str_replace('\\', '/', $class) . '.php';
    if (file_exists($file)) {
        require_once $file;
        return;
    }
});

// Bootstrap and run
$app = new App();
$app->run();
