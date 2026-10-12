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
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $t = time();
    $pdo->prepare('DELETE FROM rate_hits WHERE at < ?')->execute([$t - RATE_WINDOW]);
    $count = $pdo->prepare('SELECT COUNT(*) FROM rate_hits WHERE ip = ? AND at >= ?');
    $count->execute([$ip, $t - RATE_WINDOW]);
    if ((int) $count->fetchColumn() >= RATE_LIMIT) {
        fail(429, 'Too many requests. Please try again later.');
    }
    $pdo->prepare('INSERT INTO rate_hits (ip, at) VALUES (?, ?)')->execute([$ip, $t]);
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
        if (!is_bool($ttcConsent)) {
            throw new InvalidArgumentException('ttc_consent must be true or false');
        }
        $answers = clean_answers($body['answers'] ?? null);
    } catch (InvalidArgumentException $e) {
        fail(422, $e->getMessage());
    }
    $pdo = db();
    check_rate_limit($pdo);
    if (!$ttcConsent) {
        foreach (TTC_QUESTIONS as $q) {
            unset($answers[$q]);
        }
    }
    $token = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
    $pdo->prepare('INSERT INTO plans (token, email, answers, ttc_saved, created_at) VALUES (?, ?, ?, ?, ?)')
        ->execute([$token, $email, json_encode($answers), (int) $ttcConsent, now()]);

    // Answer the browser first, then send the email, so she isn't kept waiting.
    http_response_code(201);
    echo json_encode(['token' => $token]);
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } elseif (function_exists('litespeed_finish_request')) {
        litespeed_finish_request();
    }
    send_plan_email($email, rtrim(config()['base_url'], '/') . '/plan/' . $token);
    exit;
}

function get_plan(string $token): never
{
    $st = db()->prepare('SELECT email, answers, created_at FROM plans WHERE token = ?');
    $st->execute([$token]);
    $row = $st->fetch();
    if (!$row) {
        fail(404, 'Plan not found');
    }
    respond(200, ['email' => $row['email'], 'answers' => json_decode($row['answers'], true), 'created_at' => $row['created_at']]);
}

function delete_plan(string $token): never
{
    $st = db()->prepare('DELETE FROM plans WHERE token = ?');
    $st->execute([$token]);
    if ($st->rowCount() === 0) {
        fail(404, 'Plan not found');
    }
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
    // The token only tells us "this tap came from someone with a saved plan". It is not stored.
    $hasPlan = !empty($b['token']) ? 1 : 0;
    db()->prepare('INSERT INTO events (name, category, source, city, has_plan, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$name, $category, $source !== null ? mb_substr($source, 0, 60) : null, $city, $hasPlan, now()]);
    respond(204);
}

// ---------- dispatch ----------
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = rtrim((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');
    $path = preg_replace('#^/api#', '', $path) ?? '';

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
