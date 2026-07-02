<?php
/**
 * Middleware — IP whitelist access control.
 */

class Middleware
{
    /**
     * Check if the client IP is in the whitelist.
     * Returns 403 and exits if not allowed.
     */
    public static function checkIp(): void
    {
        $allowed = $GLOBALS['allowed_ips'] ?? [];
        if (empty($allowed)) {
            return; // No whitelist configured — allow all (dev mode)
        }

        $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';

        if (!in_array($clientIp, $allowed, true)) {
            http_response_code(403);
            header('Content-Type: text/plain; charset=utf-8');
            echo "Access denied. Your IP ({$clientIp}) is not on the allowed list.";
            exit;
        }
    }
}
