<?php
/**
 * Start Page Dashboard — Entry Point
 *
 * Thin bootstrap: load config, initialize app, dispatch request.
 */

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
