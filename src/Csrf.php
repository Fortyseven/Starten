<?php
/**
 * Csrf — Double-submit cookie CSRF protection.
 *
 * Pattern:
 *   1. Page load → generate random token, set as cookie
 *   2. Frontend JS reads cookie, sends as X-CSRF-Token header on every POST
 *   3. Server validates header matches cookie
 *
 * Attacker pages can't read the cookie (Same-Origin Policy), so they can't
 * set a matching header. Legitimate JS can read both, so normal requests work.
 */

class Csrf
{
    public const COOKIE_NAME = 'startpage_csrf';
    private const HEADER_NAME = 'X-CSRF-Token';

    /**
     * Generate a cryptographically random CSRF token.
     */
    public static function generate(): string
    {
        return bin2hex(random_bytes(32));
    }

    /**
     * Set the CSRF token as a cookie and return it for embedding in JS.
     *
     * Cookie attributes:
     *   - SameSite=Strict: only sent on same-site requests (extra CSRF layer)
     *   - HttpOnly: false (frontend JS needs to read it for the double-submit pattern)
     *   - Path=/: available to all endpoints
     */
    public static function setCookie(string $token): void
    {
        $params = [
            'expires' => time() + 86400, // 24h
            'path' => '/',
            'secure' => ($_SERVER['HTTPS'] ?? '') !== 'off'
                || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https',
            'samesite' => 'Strict',
        ];
        setcookie(self::COOKIE_NAME, $token, $params);
    }

    /**
     * Validate the CSRF token on incoming POST/PUT/DELETE requests.
     *
     * Compares the X-CSRF-Token header against the cookie value.
     * Returns true if valid, false otherwise.
     */
    public static function validate(): bool
    {
        $cookie = $_COOKIE[self::COOKIE_NAME] ?? '';
        $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

        if ($cookie === '' || $header === '') {
            return false;
        }

        return hash_equals($cookie, $header);
    }

    /**
     * Validate CSRF and exit with 403 if invalid.
     * Call this at the start of any state-mutating endpoint.
     */
    public static function require(): void
    {
        if (!self::validate()) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Invalid CSRF token']);
            exit;
        }
    }
}
