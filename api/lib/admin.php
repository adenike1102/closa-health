<?php
// Dashboard login. Two separate passwords:
//   1. the dashboard password  -> statistics only (no emails)
//   2. the contacts password   -> email addresses; asked for again, and it expires after 15 minutes
// Sessions are signed cookies (HttpOnly, SameSite=Strict), so nothing is stored on the server.

const ADMIN_COOKIE = 'closa_admin';
const CONTACTS_COOKIE = 'closa_contacts';
const ADMIN_TTL = 8 * 3600;
const CONTACTS_TTL = 15 * 60;
const LOGIN_LIMIT = 6;       // wrong passwords per IP ...
const LOGIN_WINDOW = 900;    // ... per 15 minutes

function password_for(string $level): array
{
    $c = config();
    return [$c[$level . '_password'] ?? '', $c[$level . '_password_hash'] ?? ''];
}

function admin_configured(): bool
{
    foreach (['admin', 'contacts'] as $level) {
        [$plain, $hash] = password_for($level);
        if ($plain === '' && $hash === '') {
            return false;
        }
    }
    return true;
}

function check_password(string $level, string $given): bool
{
    [$plain, $hash] = password_for($level);
    if ($hash !== '') {
        return password_verify($given, $hash);
    }
    return $plain !== '' && hash_equals($plain, $given);
}

// Key used to sign cookies. It is made from the two passwords, so changing a password logs everyone out.
function signing_key(): string
{
    [$a1, $a2] = password_for('admin');
    [$c1, $c2] = password_for('contacts');
    return hash('sha256', 'closa|' . $a1 . $a2 . '|' . $c1 . $c2);
}

function make_token(string $level, int $ttl): string
{
    $body = rtrim(strtr(base64_encode(json_encode(['l' => $level, 'e' => time() + $ttl])), '+/', '-_'), '=');
    return $body . '.' . hash_hmac('sha256', $body, signing_key());
}

function token_ok(?string $token, string $level): bool
{
    if (!$token || substr_count($token, '.') !== 1) {
        return false;
    }
    [$body, $sig] = explode('.', $token);
    if (!hash_equals(hash_hmac('sha256', $body, signing_key()), $sig)) {
        return false;
    }
    $data = json_decode((string) base64_decode(strtr($body, '-_', '+/')), true);
    return is_array($data) && ($data['l'] ?? '') === $level && ($data['e'] ?? 0) >= time();
}

function is_https(): bool
{
    return !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function set_cookie_token(string $name, string $value, int $ttl): void
{
    setcookie($name, $value, [
        'expires' => $ttl > 0 ? time() + $ttl : time() - 3600,
        'path' => '/api/admin', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict',
    ]);
}

// Every dashboard request needs a valid login. $level is 'admin' or 'contacts'.
function require_login(string $level): void
{
    if (!admin_configured()) {
        fail(503, 'The dashboard is not set up yet. Add the two dashboard passwords to api/config.php.');
    }
    if (!token_ok($_COOKIE[ADMIN_COOKIE] ?? null, 'admin')) {
        fail(401, 'Please sign in.');
    }
    if ($level === 'contacts' && !token_ok($_COOKIE[CONTACTS_COOKIE] ?? null, 'contacts')) {
        fail(403, 'Enter the contacts password to see email addresses.');
    }
}

// Requests that change something must carry this header, which other websites cannot add.
function require_admin_header(): void
{
    if (($_SERVER['HTTP_X_CLOSA_ADMIN'] ?? '') !== '1') {
        fail(403, 'Missing header');
    }
}

// Password attempts. Wrong guesses are counted per IP; too many in 15 minutes locks that IP out for a while.
function try_login(string $level, string $given): bool
{
    $pdo = db();
    $key = 'login:' . $level . ':' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (!rate_ok($pdo, $key, LOGIN_LIMIT, LOGIN_WINDOW, false)) {
        fail(429, 'Too many wrong attempts. Please wait 15 minutes and try again.');
    }
    if (check_password($level, $given)) {
        return true;
    }
    rate_ok($pdo, $key, LOGIN_LIMIT, LOGIN_WINDOW, true); // record the failure
    return false;
}
