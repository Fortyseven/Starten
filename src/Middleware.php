<?php
/**
 * Middleware — IP whitelist access control.
 */

class Middleware
{
    /**
     * Check if the client IP is in the whitelist.
     * Redirects to network47.org if not allowed.
     */
    public static function checkIp(): void
    {
        $allowed = $GLOBALS['allowed_ips'] ?? [];
        if (empty($allowed)) {
            return; // No whitelist configured — allow all (dev mode)
        }

        $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';

        $redirect = getenv('REDIRECT_URL') ?: 'https://network47.org';
        if (!in_array($clientIp, $allowed, true)) {
            header('Location: ' . $redirect, true, 302);
            exit;
        }
    }
}
