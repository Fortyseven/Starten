<?php
/**
 * Start Page Dashboard — Configuration
 *
 * Edit these values to configure your start page.
 */

// Allowed IP addresses (exact match only).
// Add your server's internal IP, localhost, etc.
$allowed_ips = [
    '127.0.0.1',
    '::1',
    // '192.168.1.5',
];

// Path to the SQLite database file (relative to this file's directory).
$db_path = __DIR__ . '/data/startpage.db';

// Application display name (shown in page title).
$app_name = 'My Start Page';
