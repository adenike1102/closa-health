<?php
declare(strict_types=1);
/*
 * Closa Health API (PHP + SQLite), for shared hosting.
 *
 *   POST   /api/plans            save answers against an email, email the plan link
 *   GET    /api/plans/{token}    open a saved plan (the token in the emailed link is the key)
 *   DELETE /api/plans/{token}    delete a saved plan
 *   GET    /api/providers        provider directory, filtered by city and category
 *   POST   /api/events           anonymous analytics on action taps
 *   GET    /api/health           uptime check
 *   /api/admin/...               the dashboard (two passwords, see lib/admin.php)
 *
 * There are no accounts: the email is the identity, and the long random token in the link is
 * what lets someone open a plan. The care plan itself is worked out in the browser from the
 * saved answers (frontend/src/lib/evaluate.js).
 *
 * The web server sends every /api/... request here (see the .htaccess in the site root).
 */

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/answers.php';
require __DIR__ . '/lib/mailer.php';
require __DIR__ . '/lib/admin.php';
require __DIR__ . '/lib/stats.php';

const RATE_LIMIT = 10;      // plans per IP per hour
const RATE_WINDOW = 3600;

ini_set('display_errors', '0'); // never show PHP errors to visitors
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, mixed $data = null): never
{
    http_response_code($status);
    if ($status !== 204) {
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

// Errors use the same shape as before: {"detail": "..."}
function fail(int $status, string $message): never
{
    respond($status, ['detail' => $message]);
}

function read_json(): array
{
    $data = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($data) || array_is_list($data) && $data !== []) {
        fail(422, 'Body must be a JSON object');
    }
    return $data;
}

function now(): string
{
    return gmdate('c');
}

// Stops the email form being used to spam people: 10 saved plans per IP per hour.
function check_rate_limit(PDO $pdo): void
{
    if (!rate_ok($pdo, $_SERVER['REMOTE_ADDR'] ?? 'unknown', RATE_LIMIT, RATE_WINDOW)) {
        fail(429, 'Too many requests. Please try again later.');
    }
}

// ---------- routes ----------
function create_plan(): never
{
    $body = read_json();
    try {
        $email = clean_email($body['email'] ?? null);
        if (($body['consent'] ?? false) !== true) {
            throw new InvalidArgumentException('Consent is required');
        }
        $ttcConsent = ($body['ttc_consent'] ?? false);
        $launchOptin = ($body['launch_optin'] ?? false);
        if (!is_bool($ttcConsent) || !is_bool($launchOptin)) {
            throw new InvalidArgumentException('ttc_consent and launch_optin must be true or false');
        }
        $name = clean_name($body['name'] ?? null);
        $answers = clean_answers($body['answers'] ?? null);
    } catch (InvalidArgumentException $e) {
        fail(422, $e->getMessage());
    }
    // These only feed the dashboard, so a problem with them never stops a plan being saved.
    $sid = clean_sid($body['sid'] ?? null);
    $outcome = clean_outcome($body['outcome'] ?? null);

    $pdo = db();
    check_rate_limit($pdo);
    if (!$ttcConsent) {
        foreach (TTC_QUESTIONS as $q) {
            unset($answers[$q]);
        }
    }
    $token = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
    $when = now();
    $pdo->prepare('INSERT INTO plans (token, email, name, answers, ttc_saved, launch_optin, mail_status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$token, $email, $name, json_encode($answers), (int) $ttcConsent, (int) $launchOptin, 'pending', $when]);
    $planId = (int) $pdo->lastInsertId();
    insert_plan_stats($pdo, $answers, $outcome, $when);
    $pdo->prepare('INSERT INTO events (name, sid, created_at) VALUES (?, ?, ?)')->execute(['plan_created', $sid, $when]);

    // Answer the browser first, then send the email, so she isn't kept waiting.
    http_response_code(201);
    echo json_encode(['token' => $token]);
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } elseif (function_exists('litespeed_finish_request')) {
        litespeed_finish_request();
    }
    $sent = send_plan_email($email, rtrim(config()['base_url'], '/') . '/plan/' . $token, $name);
    $pdo->prepare('UPDATE plans SET mail_status = ? WHERE id = ?')->execute([$sent ? 'sent' : 'failed', $planId]);
    exit;
}

function get_plan(string $token): never
{
    $st = db()->prepare('SELECT email, name, answers, created_at FROM plans WHERE token = ? AND deleted_at IS NULL');
    $st->execute([$token]);
    $row = $st->fetch();
    if (!$row) {
        fail(404, 'Plan not found');
    }
    respond(200, ['email' => $row['email'], 'name' => $row['name'], 'answers' => json_decode($row['answers'], true), 'created_at' => $row['created_at']]);
}

function delete_plan(string $token): never
{
    $pdo = db();
    $st = $pdo->prepare('SELECT id FROM plans WHERE token = ? AND deleted_at IS NULL');
    $st->execute([$token]);
    $id = $st->fetchColumn();
    if ($id === false) {
        fail(404, 'Plan not found');
    }
    tombstone_plan($pdo, (int) $id); // wipes email, name and answers; keeps only "deleted on <date>"
    $pdo->prepare('INSERT INTO events (name, created_at) VALUES (?, ?)')->execute(['plan_delete', now()]);
    respond(204);
}

function list_providers(): never
{
    $city = $_GET['city'] ?? null;
    $cat = $_GET['cat'] ?? null;
    if (!is_string($city) || !is_string($cat)) {
        fail(422, 'city and cat are required');
    }
    if (!in_array($city, CITIES, true)) {
        fail(422, 'Unknown city');
    }
    if (!in_array($cat, CATEGORIES, true)) {
        fail(422, 'Unknown category');
    }
    // The directory is plain data in data/providers.json. Edit that file to update the list.
    $file = config()['providers_file'] ?: __DIR__ . '/data/providers.json';
    $all = json_decode(file_get_contents($file), true);
    $inCity = [];
    foreach ($all as $i => $p) {
        if ($p['city'] === $city) {
            $inCity[] = ['id' => $i + 1] + $p;
        }
    }
    $matches = array_values(array_filter($inCity, fn($p) => in_array($cat, $p['cats'], true)));
    $fallback = $matches === [];
    if ($fallback) { // no dedicated listing: show the city's general hospitals that can refer her on
        $matches = array_values(array_filter($inCity, fn($p) => in_array('gp', $p['cats'], true)));
    }
    $out = array_map(function ($p) {
        unset($p['cats']);
        return $p;
    }, $matches);
    respond(200, ['providers' => $out, 'fallback' => $fallback]);
}

function record_event(): never
{
    $b = read_json();
    $pdo = db();
    // Generous limit per IP, only to stop someone flooding the numbers.
    if (!rate_ok($pdo, 'ev:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 600, 600)) {
        fail(429, 'Too many requests.');
    }
    $name = $b['name'] ?? null;
    if (!is_string($name) || !in_array($name, EVENT_NAMES, true)) {
        fail(422, 'Unknown event');
    }
    $category = $b['category'] ?? null;
    if ($category !== null && (!is_string($category) || !in_array($category, CATEGORIES, true))) {
        fail(422, 'Unknown category');
    }
    $city = $b['city'] ?? null;
    if ($city !== null && (!is_string($city) || !in_array($city, CITIES, true))) {
        fail(422, 'Unknown city');
    }
    $source = $b['source'] ?? null;
    if ($source !== null && !is_string($source)) {
        fail(422, 'Invalid source');
    }
    $step = $b['step'] ?? null;
    if ($step !== null && (!is_string($step) || !preg_match('/^[A-Za-z0-9_]{1,16}$/', $step))) {
        fail(422, 'Invalid step');
    }
    $device = $b['device'] ?? null;
    if ($device !== null && !in_array($device, ['m', 't', 'd'], true)) {
        fail(422, 'Invalid device');
    }
    $sid = clean_sid($b['sid'] ?? null);
    // The token only tells us "this tap came from someone with a saved plan". It is not stored.
    $hasPlan = !empty($b['token']) ? 1 : 0;
    // A visit is counted once per anonymous code.
    if ($name === 'session_start' && $sid !== null
        && scalar($pdo, "SELECT COUNT(*) FROM events WHERE name = 'session_start' AND sid = ?", [$sid]) > 0) {
        respond(204);
    }
    $pdo->prepare('INSERT INTO events (name, category, source, city, step, device, sid, utm_source, utm_medium, utm_campaign, referrer, has_plan, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $name, $category, $source !== null ? mb_substr($source, 0, 60) : null, $city, $step, $device, $sid,
            clean_tag($b['utm_source'] ?? null), clean_tag($b['utm_medium'] ?? null), clean_tag($b['utm_campaign'] ?? null),
            clean_tag($b['referrer'] ?? null, 100), $hasPlan, now(),
        ]);
    respond(204);
}

// ---------- dashboard ----------
function admin_route(string $method, string $path): void
{
    header('X-Robots-Tag: noindex');
    if ($path === '/admin/login' && $method === 'POST') {
        if (!admin_configured()) {
            fail(503, 'The dashboard is not set up yet. Add the two dashboard passwords to api/config.php.');
        }
        require_admin_header();
        $given = read_json()['password'] ?? '';
        if (!is_string($given) || !try_login('admin', $given)) {
            fail(401, 'That password is not right.');
        }
        set_cookie_token(ADMIN_COOKIE, make_token('admin', ADMIN_TTL), ADMIN_TTL);
        respond(200, ['ok' => true]);
    }
    if ($path === '/admin/logout' && $method === 'POST') {
        require_admin_header();
        set_cookie_token(ADMIN_COOKIE, '', 0);
        set_cookie_token(CONTACTS_COOKIE, '', 0);
        respond(204);
    }
    if ($path === '/admin/session' && $method === 'GET') {
        require_login('admin');
        respond(200, ['ok' => true, 'contacts_unlocked' => token_ok($_COOKIE[CONTACTS_COOKIE] ?? null, 'contacts')]);
    }
    if ($path === '/admin/contacts/unlock' && $method === 'POST') {
        require_login('admin');
        require_admin_header();
        $given = read_json()['password'] ?? '';
        if (!is_string($given) || !try_login('contacts', $given)) {
            fail(401, 'That password is not right.');
        }
        set_cookie_token(CONTACTS_COOKIE, make_token('contacts', CONTACTS_TTL), CONTACTS_TTL);
        respond(200, ['ok' => true, 'expires_in' => CONTACTS_TTL]);
    }
    if ($path === '/admin/contacts/lock' && $method === 'POST') {
        require_login('admin');
        require_admin_header();
        set_cookie_token(CONTACTS_COOKIE, '', 0);
        respond(204);
    }
    if ($path === '/admin/stats' && $method === 'GET') {
        require_login('admin');
        $tz = new DateTimeZone('Africa/Lagos');
        $today = (new DateTimeImmutable('now', $tz))->format('Y-m-d');
        $to = $_GET['to'] ?? $today;
        $from = $_GET['from'] ?? (new DateTimeImmutable($to))->modify('-29 days')->format('Y-m-d');
        $ok = fn($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int) substr($d, 5, 2), (int) substr($d, 8, 2), (int) substr($d, 0, 4));
        if (!$ok($from) || !$ok($to) || $from > $to) {
            fail(422, 'Choose a valid date range.');
        }
        if ((new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->days > 365) {
            fail(422, 'Choose a range of one year or less.');
        }
        respond(200, build_stats($from, $to));
    }
    if ($path === '/admin/contacts' && $method === 'GET') {
        require_login('contacts');
        $list = contacts_list(($_GET['optin'] ?? '') === '1', is_string($_GET['q'] ?? null) ? trim($_GET['q']) : '');
        respond(200, ['contacts' => $list, 'limit_reached' => count($list) >= 2000]);
    }
    if ($path === '/admin/contacts.csv' && $method === 'GET') {
        require_login('contacts');
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="closa-launch-list-' . gmdate('Y-m-d') . '.csv"');
        echo launch_list_csv();
        exit;
    }
    if (preg_match('#^/admin/contacts/(\d+)$#', $path, $m) && $method === 'DELETE') {
        require_login('contacts');
        require_admin_header();
        $pdo = db();
        if (scalar($pdo, 'SELECT COUNT(*) FROM plans WHERE id = ? AND deleted_at IS NULL', [(int) $m[1]]) === 0) {
            fail(404, 'Contact not found');
        }
        tombstone_plan($pdo, (int) $m[1]);
        $pdo->prepare('INSERT INTO events (name, created_at) VALUES (?, ?)')->execute(['plan_delete', now()]);
        respond(204);
    }
    fail(404, 'Not found');
}

// ---------- dispatch ----------
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = rtrim((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');
    $path = preg_replace('#^/api#', '', $path) ?? '';

    if (str_starts_with($path, '/admin/')) {
        admin_route($method, $path);
    }
    if ($path === '/health' && $method === 'GET') {
        // Also proves the database can be opened, which is the first thing to check after an upload.
        if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
            fail(503, 'The PHP extension pdo_sqlite is not enabled. Turn it on in hPanel > PHP Configuration.');
        }
        db();
        respond(200, ['status' => 'ok']);
    }
    if ($path === '/plans' && $method === 'POST') {
        create_plan();
    }
    if (preg_match('#^/plans/([^/]+)$#', $path, $m)) {
        $token = rawurldecode($m[1]);
        if ($method === 'GET') {
            get_plan($token);
        }
        if ($method === 'DELETE') {
            delete_plan($token);
        }
        header('Allow: GET, DELETE');
        fail(405, 'Method not allowed');
    }
    if ($path === '/providers' && $method === 'GET') {
        list_providers();
    }
    if ($path === '/events' && $method === 'POST') {
        record_event();
    }
    fail(404, 'Not found');
} catch (Throwable $e) {
    error_log('Closa API error: ' . $e->getMessage());
    fail(500, 'Something went wrong. Please try again.');
}
