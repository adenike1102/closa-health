<?php
// SQLite database. The file is kept OUTSIDE public_html when possible so it can never be downloaded.

function db_path(): string
{
    $configured = config()['db_path'];
    if ($configured !== '') {
        return $configured;
    }
    // .../public_html/api -> .../closa-data (a sibling of public_html)
    $outside = dirname(__DIR__, 3) . '/closa-data';
    if ((is_dir($outside) || @mkdir($outside, 0750, true)) && is_writable($outside)) {
        return $outside . '/closa.db';
    }
    // Fallback: a folder inside api/ that .htaccess blocks from the web.
    $inside = dirname(__DIR__) . '/storage';
    if (!is_dir($inside)) {
        @mkdir($inside, 0750, true);
    }
    return $inside . '/closa.db';
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . db_path(), null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA busy_timeout = 5000');
    init_db($pdo);
    return $pdo;
}

// Creates tables if missing. To change the schema later, add ALTER TABLE statements here
// so existing databases keep their saved plans.
function init_db(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        answers TEXT NOT NULL,
        ttc_saved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_plans_email ON plans(email)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        source TEXT,
        city TEXT,
        has_plan INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    )');
    // PHP forgets everything between requests, so the rate limit lives in the database.
    $pdo->exec('CREATE TABLE IF NOT EXISTS rate_hits (
        ip TEXT NOT NULL,
        at INTEGER NOT NULL
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_rate_ip ON rate_hits(ip, at)');
}
