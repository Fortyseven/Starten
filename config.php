<?php
/**
 * Start Page Dashboard — Configuration
 *
 * Edit these values to configure your start page.
 */

// Allowed IP addresses — loaded from .env (ALLOWED_IPS, comma-separated).
// See .env.example for reference.
$allowed_ips = array_map('trim', explode(',', getenv('ALLOWED_IPS') ?: ''));

// Path to the SQLite database file (relative to this file's directory).
$db_path = __DIR__ . '/data/startpage.db';

// Application display name (shown in page title).
$app_name = 'My Start Page';
