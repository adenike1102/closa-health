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

// Adds a column to an existing table if it isn't there yet (so old databases are upgraded, never reset).
function add_column(PDO $pdo, string $table, string $column, string $definition): void
{
    $have = array_column($pdo->query("PRAGMA table_info($table)")->fetchAll(), 'name');
    if (!in_array($column, $have, true)) {
        $pdo->exec("ALTER TABLE $table ADD COLUMN $column $definition");
    }
}

// Creates tables if missing and upgrades older ones. To change the schema later, add another
// add_column() line here so existing databases keep their saved plans.
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
    add_column($pdo, 'plans', 'name', 'TEXT');
    add_column($pdo, 'plans', 'launch_optin', 'INTEGER NOT NULL DEFAULT 0'); // "keep me updated" tickbox
    add_column($pdo, 'plans', 'deleted_at', 'TEXT');                         // set when the user deletes their plan
    add_column($pdo, 'plans', 'mail_status', 'TEXT');                        // pending | sent | failed
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
    add_column($pdo, 'events', 'sid', 'TEXT');          // random anonymous code, not linked to any email
    add_column($pdo, 'events', 'step', 'TEXT');
    add_column($pdo, 'events', 'device', 'TEXT');
    add_column($pdo, 'events', 'utm_source', 'TEXT');
    add_column($pdo, 'events', 'utm_medium', 'TEXT');
    add_column($pdo, 'events', 'utm_campaign', 'TEXT');
    add_column($pdo, 'events', 'referrer', 'TEXT');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_events_name_time ON events(name, created_at)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_events_sid ON events(sid)');

    // Anonymous, coarse summary of each plan, kept for the dashboard. It has NO email, name,
    // token or id link back to a plan, so it stays when a user deletes their plan.
    $pdo->exec('CREATE TABLE IF NOT EXISTS plan_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        age TEXT, concerns TEXT, contraception TEXT, cycle TEXT, pain TEXT,
        conditions TEXT, history TEXT, ttc TEXT,
        urgency INTEGER, flags TEXT, who TEXT, tests TEXT, safety TEXT
    )');
    add_column($pdo, 'plan_stats', 'onset', 'TEXT');          // Q19: when it started
    add_column($pdo, 'plan_stats', 'days', 'TEXT');           // Q20: days affected per month
    add_column($pdo, 'plan_stats', 'premenstrual', 'TEXT');   // Q17: symptoms before a period
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_stats_time ON plan_stats(created_at)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');

    // PHP forgets everything between requests, so rate limits live in the database too.
    $pdo->exec('CREATE TABLE IF NOT EXISTS rate_hits (
        ip TEXT NOT NULL,
        at INTEGER NOT NULL
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_rate_ip ON rate_hits(ip, at)');

    migrate_codes_v2($pdo);

    // Plans saved before plan_stats existed: build their anonymous summary once.
    if ((int) $pdo->query('SELECT COUNT(*) FROM plan_stats')->fetchColumn() === 0) {
        $old = $pdo->query('SELECT answers, created_at FROM plans WHERE deleted_at IS NULL')->fetchAll();
        foreach ($old as $row) {
            insert_plan_stats($pdo, json_decode($row['answers'], true) ?: [], null, $row['created_at']);
        }
    }
}

// Stores the anonymous summary used by the dashboard. $outcome (urgency, flags, ...) comes from the
// browser, which is where the care plan is worked out.
function insert_plan_stats(PDO $pdo, array $answers, ?array $outcome, string $createdAt): void
{
    $one = fn($q) => isset($answers[$q]) && is_string($answers[$q]) ? $answers[$q] : null;
    $many = fn($q) => json_encode(array_values(array_filter((array) ($answers[$q] ?? []), fn($c) => $c !== 'none')));
    $pdo->prepare('INSERT INTO plan_stats
        (created_at, age, concerns, contraception, cycle, pain, conditions, history, ttc, onset, days, premenstrual, urgency, flags, who, tests, safety)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
        $createdAt, $one('Q2'), $many('Q1'), $one('Q4'), $one('Q5'), $one('Q10'), $many('Q14'), $many('Q15'),
        $one('Q16'), // only present when she agreed to save pregnancy plans
        $one('Q19'), $one('Q20'), $many('Q17'), // note: the mood safety answer (Q18) is deliberately never copied here
        $outcome['urgency'] ?? null,
        $outcome ? json_encode($outcome['flags']) : null,
        $outcome ? json_encode($outcome['who']) : null,
        $outcome ? json_encode($outcome['tests']) : null,
        $outcome ? json_encode($outcome['safety']) : null,
    ]);
}

// Deleting keeps a marker (so the dashboard can show "Deleted") but wipes everything personal.
function tombstone_plan(PDO $pdo, int $id): void
{
    $pdo->prepare("UPDATE plans SET email = '', name = NULL, answers = '{}', launch_optin = 0, ttc_saved = 0,
                   token = ?, deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
        ->execute(['deleted-' . $id . '-' . bin2hex(random_bytes(8)), gmdate('c'), $id]);
}

// Counts a hit against a limit. Returns false when the limit has been reached.
function rate_ok(PDO $pdo, string $key, int $limit, int $window, bool $record = true): bool
{
    $t = time();
    $pdo->prepare('DELETE FROM rate_hits WHERE at < ?')->execute([$t - 7200]); // longest limit is 1 hour; IPs are not kept longer than 2
    $st = $pdo->prepare('SELECT COUNT(*) FROM rate_hits WHERE ip = ? AND at >= ?');
    $st->execute([$key, $t - $window]);
    if ((int) $st->fetchColumn() >= $limit) {
        return false;
    }
    if ($record) {
        $pdo->prepare('INSERT INTO rate_hits (ip, at) VALUES (?, ?)')->execute([$key, $t]);
    }
    return true;
}

// One-time upgrade: the first question and "PCOS" were renamed in questionnaire v2. Saved plans (and their
// anonymous summaries) are rewritten to the new codes, so older plans still open correctly.
function migrate_codes_v2(PDO $pdo): void
{
    if ($pdo->query("SELECT v FROM meta WHERE k = 'codes_v2'")->fetchColumn() !== false) {
        return;
    }
    $map = [
        'Q1' => ['pain' => 'less_pain', 'heavy' => 'lighter_periods', 'irregular' => 'regular_periods', 'other_bleeding' => 'odd_bleeding', 'ttc' => 'get_pregnant'],
        'Q14' => ['pcos' => 'pmos'],
    ];
    $remap = fn(array $list, array $m) => array_values(array_unique(array_map(fn($c) => $m[$c] ?? $c, $list)));
    $pdo->beginTransaction();
    $upd = $pdo->prepare('UPDATE plans SET answers = ? WHERE id = ?');
    foreach ($pdo->query('SELECT id, answers FROM plans WHERE deleted_at IS NULL')->fetchAll() as $row) {
        $a = json_decode($row['answers'], true);
        if (!is_array($a)) {
            continue;
        }
        $changed = false;
        foreach ($map as $q => $m) {
            if (isset($a[$q]) && is_array($a[$q])) {
                $new = $remap($a[$q], $m);
                $changed = $changed || $new !== $a[$q];
                $a[$q] = $new;
            }
        }
        if ($changed) {
            $upd->execute([json_encode($a), $row['id']]);
        }
    }
    $updStat = $pdo->prepare('UPDATE plan_stats SET concerns = ?, conditions = ? WHERE id = ?');
    foreach ($pdo->query('SELECT id, concerns, conditions FROM plan_stats')->fetchAll() as $row) {
        $c = $remap(json_decode($row['concerns'] ?: '[]', true) ?: [], $map['Q1']);
        $d = $remap(json_decode($row['conditions'] ?: '[]', true) ?: [], $map['Q14']);
        $updStat->execute([json_encode($c), json_encode($d), $row['id']]);
    }
    $pdo->exec("INSERT INTO meta (k, v) VALUES ('codes_v2', '1')");
    $pdo->commit();
}
