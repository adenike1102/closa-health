<?php
// Numbers for the dashboard. Everything is a total: individual answers and emails never leave this file
// (except in the contacts list, which has its own password).
//
// Days are Lagos days (UTC+1). Timestamps are stored in UTC, so a day starts at 23:00 UTC the evening before.

const MIN_GROUP = 5; // groups smaller than this are shown as "<5" so nobody can be picked out

function lagos_range(string $from, string $to): array
{
    $lagos = new DateTimeZone('Africa/Lagos');
    $utc = new DateTimeZone('UTC');
    $start = (new DateTimeImmutable($from . ' 00:00:00', $lagos))->setTimezone($utc);
    $end = (new DateTimeImmutable($to . ' 00:00:00', $lagos))->modify('+1 day')->setTimezone($utc);
    return [$start->format('Y-m-d\TH:i:s'), $end->format('Y-m-d\TH:i:s')];
}

function scalar(PDO $pdo, string $sql, array $params = []): int
{
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return (int) $st->fetchColumn();
}

function rows(PDO $pdo, string $sql, array $params = []): array
{
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->fetchAll();
}

// Counts for one period, used for "this period" and "previous period".
function period_numbers(PDO $pdo, string $s, string $e): array
{
    $b = [':s' => $s, ':e' => $e];
    $in = 'substr(created_at,1,19) >= :s AND substr(created_at,1,19) < :e';
    $people = fn(string $name, string $extra = '') => scalar(
        $pdo,
        "SELECT COUNT(DISTINCT sid) FROM events WHERE name = '$name' AND sid IS NOT NULL AND $in $extra",
        $b
    );
    $started = $people('question_view', "AND step = 'Q0'");
    $planned = $people('plan_created');
    $north = scalar(
        $pdo,
        "SELECT COUNT(DISTINCT e.sid) FROM events e
         WHERE e.name = 'directions_tap' AND e.sid IS NOT NULL
           AND substr(e.created_at,1,19) >= :s AND substr(e.created_at,1,19) < :e
           AND EXISTS (SELECT 1 FROM events p WHERE p.sid = e.sid AND p.name = 'plan_created')",
        $b
    );
    return [
        'visitors' => $people('session_start'),
        'cta' => $people('cta_click'),
        'started' => $started,
        'email_screen' => $people('email_view'),
        'plan_sessions' => $planned,
        'plan_views' => $people('plan_view'),
        'providers' => $people('provider_view'),
        'directions' => $people('directions_tap'),
        'plans' => scalar($pdo, "SELECT COUNT(*) FROM plans WHERE $in", $b),
        'emails_active' => scalar($pdo, "SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL AND $in", $b),
        'launch_optins' => scalar($pdo, "SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL AND launch_optin = 1 AND $in", $b),
        'ttc_optins' => scalar($pdo, "SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL AND ttc_saved = 1 AND $in", $b),
        'deleted' => scalar($pdo, 'SELECT COUNT(*) FROM plans WHERE deleted_at IS NOT NULL AND substr(deleted_at,1,19) >= :s AND substr(deleted_at,1,19) < :e', $b),
        'completion' => $started > 0 ? min(1, $planned / $started) : null,
        // The north-star: of the sessions that made a plan, how many then tapped "Get directions".
        'care_intent' => $planned > 0 ? min(1, $north / $planned) : null,
        'north_sessions' => $north,
    ];
}

// A breakdown as a list, with small groups hidden.
function breakdown(array $counts, int $limit = 0): array
{
    arsort($counts);
    $out = [];
    foreach ($counts as $key => $n) {
        $out[] = ['key' => (string) $key, 'count' => $n >= MIN_GROUP ? $n : null, 'small' => $n < MIN_GROUP];
    }
    return $limit ? array_slice($out, 0, $limit) : $out;
}

function tally(array $values, array &$into): void
{
    foreach ($values as $v) {
        if ($v !== null && $v !== '') {
            $into[$v] = ($into[$v] ?? 0) + 1;
        }
    }
}

function build_stats(string $from, string $to): array
{
    $pdo = db();
    [$s, $e] = lagos_range($from, $to);
    $days = (int) ((new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->days) + 1;
    $prevTo = (new DateTimeImmutable($from))->modify('-1 day')->format('Y-m-d');
    $prevFrom = (new DateTimeImmutable($from))->modify('-' . $days . ' days')->format('Y-m-d');
    [$ps, $pe] = lagos_range($prevFrom, $prevTo);
    $b = [':s' => $s, ':e' => $e];
    $in = 'substr(created_at,1,19) >= :s AND substr(created_at,1,19) < :e';

    $now = period_numbers($pdo, $s, $e);
    $before = period_numbers($pdo, $ps, $pe);

    // Daily series
    $perDayVisitors = array_column(rows($pdo, "SELECT date(substr(created_at,1,19),'+1 hour') d, COUNT(DISTINCT sid) n
        FROM events WHERE name = 'session_start' AND $in GROUP BY d", $b), 'n', 'd');
    $perDayPlans = array_column(rows($pdo, "SELECT date(substr(created_at,1,19),'+1 hour') d, COUNT(*) n
        FROM plans WHERE $in GROUP BY d", $b), 'n', 'd');
    $series = [];
    for ($i = 0; $i < $days; $i++) {
        $d = (new DateTimeImmutable($from))->modify("+$i days")->format('Y-m-d');
        $series[] = ['date' => $d, 'visitors' => (int) ($perDayVisitors[$d] ?? 0), 'plans' => (int) ($perDayPlans[$d] ?? 0)];
    }

    // Funnel + drop-off per question
    $funnel = [
        ['key' => 'visit', 'label' => 'Visited the site', 'count' => $now['visitors']],
        ['key' => 'cta', 'label' => 'Tapped “Get my free care plan”', 'count' => $now['cta']],
        ['key' => 'started', 'label' => 'Started the questions', 'count' => $now['started']],
        ['key' => 'email', 'label' => 'Reached the email screen', 'count' => $now['email_screen']],
        ['key' => 'plan', 'label' => 'Got a care plan', 'count' => $now['plan_sessions']],
        ['key' => 'providers', 'label' => 'Opened the provider list', 'count' => $now['providers']],
        ['key' => 'directions', 'label' => 'Tapped “Get directions”', 'count' => $now['directions']],
    ];
    $seen = array_column(rows($pdo, "SELECT step, COUNT(DISTINCT sid) n FROM events
        WHERE name = 'question_view' AND sid IS NOT NULL AND step IS NOT NULL AND $in GROUP BY step", $b), 'n', 'step');
    $questions = [];
    foreach (array_keys(schema()) as $qid) {
        if ($qid === 'Q5') {
            $questions[] = ['id' => 'UP', 'count' => (int) ($seen['UP'] ?? 0)]; // the optional period-app step sits before Q5
        }
        $questions[] = ['id' => $qid, 'count' => (int) ($seen[$qid] ?? 0)];
    }

    // Where visitors come from
    $label = "COALESCE(NULLIF(utm_source,''), NULLIF(referrer,''), 'direct')";
    $sources = rows($pdo, "SELECT $label AS source, COALESCE(utm_medium,'') medium, COALESCE(utm_campaign,'') campaign,
            COUNT(*) visitors,
            SUM(EXISTS (SELECT 1 FROM events x WHERE x.sid = s.sid AND x.name = 'question_view' AND x.step = 'Q0')) started,
            SUM(EXISTS (SELECT 1 FROM events x WHERE x.sid = s.sid AND x.name = 'plan_created')) plans
        FROM (SELECT sid, utm_source, utm_medium, utm_campaign, referrer FROM events
              WHERE name = 'session_start' AND sid IS NOT NULL AND $in GROUP BY sid) s
        GROUP BY source, medium, campaign ORDER BY visitors DESC LIMIT 25", $b);
    foreach ($sources as &$r) {
        $r['visitors'] = (int) $r['visitors'];
        $r['started'] = (int) $r['started'];
        $r['plans'] = (int) $r['plans'];
    }
    unset($r);
    $devices = rows($pdo, "SELECT COALESCE(device,'?') AS key, COUNT(DISTINCT sid) n FROM events
        WHERE name = 'session_start' AND sid IS NOT NULL AND $in GROUP BY key ORDER BY n DESC", $b);
    $symptoms = rows($pdo, "SELECT step key, COUNT(*) n FROM events WHERE name = 'symptom_pick' AND step IS NOT NULL AND $in GROUP BY step ORDER BY n DESC", $b);
    $ctaWhere = rows($pdo, "SELECT COALESCE(source,'?') key, COUNT(*) n FROM events WHERE name = 'cta_click' AND $in GROUP BY source ORDER BY n DESC", $b);

    // Audience + care plan outcomes: from the anonymous plan_stats rows (these stay when someone deletes a plan)
    $stat = rows($pdo, "SELECT * FROM plan_stats WHERE $in", $b);
    $n = count($stat);
    $age = $concerns = $cycle = $pain = $contra = $cond = $hist = $ttc = $onset = $daysHit = $pm = [];
    $urg = $flags = $who = $tests = $safety = [];
    $withOutcome = 0;
    foreach ($stat as $r) {
        tally([$r['age']], $age);
        tally(json_decode($r['concerns'] ?: '[]', true), $concerns);
        tally([$r['cycle']], $cycle);
        tally([$r['pain']], $pain);
        tally([$r['contraception']], $contra);
        tally(json_decode($r['conditions'] ?: '[]', true), $cond);
        tally(json_decode($r['history'] ?: '[]', true), $hist);
        tally([$r['ttc']], $ttc);
        tally([$r['onset'] ?? null], $onset);
        tally([$r['days'] ?? null], $daysHit);
        tally(json_decode($r['premenstrual'] ?: '[]', true), $pm);
        if ($r['urgency'] !== null) {
            $withOutcome++;
            tally([(string) $r['urgency']], $urg);
            tally(json_decode($r['flags'] ?: '[]', true), $flags);
            tally(json_decode($r['who'] ?: '[]', true), $who);
            tally(json_decode($r['tests'] ?: '[]', true), $tests);
            tally(json_decode($r['safety'] ?: '[]', true), $safety);
        }
    }
    $enough = $n >= MIN_GROUP;
    $audience = ['n' => $n, 'enough' => $enough, 'age' => breakdown($age), 'concerns' => breakdown($concerns), 'cycle' => breakdown($cycle),
        'pain' => breakdown($pain), 'contraception' => breakdown($contra), 'conditions' => breakdown($cond),
        'history' => breakdown($hist), 'ttc' => breakdown($ttc), 'ttc_n' => array_sum($ttc),
        'onset' => breakdown($onset), 'days' => breakdown($daysHit), 'premenstrual' => breakdown($pm)];
    $care = ['n' => $withOutcome, 'enough' => $withOutcome >= MIN_GROUP, 'urgency' => breakdown($urg), 'flags' => breakdown($flags, 12),
        'who' => breakdown($who), 'tests' => breakdown($tests, 12), 'safety' => breakdown($safety)];
    if (!$enough) {
        foreach (['age', 'concerns', 'cycle', 'pain', 'contraception', 'conditions', 'history', 'ttc', 'onset', 'days', 'premenstrual'] as $k) {
            $audience[$k] = [];
        }
    }
    if (!$care['enough']) {
        foreach (['urgency', 'flags', 'who', 'tests', 'safety'] as $k) {
            $care[$k] = [];
        }
    }

    // Engagement
    $listed = [];
    foreach (json_decode(file_get_contents(config()['providers_file'] ?: __DIR__ . '/../data/providers.json'), true) as $p) {
        $listed[$p['city']] = ($listed[$p['city']] ?? 0) + 1;
    }
    $dirByCity = array_column(rows($pdo, "SELECT city, COUNT(*) n FROM events WHERE name = 'directions_tap' AND city IS NOT NULL AND $in GROUP BY city", $b), 'n', 'city');
    $viewByCity = array_column(rows($pdo, "SELECT city, COUNT(*) n FROM events WHERE name = 'provider_view' AND city IS NOT NULL AND $in GROUP BY city", $b), 'n', 'city');
    $cities = [];
    foreach (CITIES as $c) {
        $cities[] = ['city' => $c, 'listings' => (int) ($listed[$c] ?? 0), 'views' => (int) ($viewByCity[$c] ?? 0), 'directions' => (int) ($dirByCity[$c] ?? 0)];
    }
    $one = fn(string $name, string $col) => rows($pdo, "SELECT COALESCE($col,'?') key, COUNT(*) n FROM events WHERE name = '$name' AND $in GROUP BY $col ORDER BY n DESC", $b);
    $engagement = [
        'actions_by_category' => $one('plan_action', 'category'),
        'directions_by_category' => $one('directions_tap', 'category'),
        'plan_views_by_source' => $one('plan_view', 'source'),
        'csv_by_result' => $one('csv_upload', 'source'),
        'cities' => $cities,
        'checklist_ticks' => scalar($pdo, "SELECT COUNT(*) FROM events WHERE name = 'checklist_tick' AND $in", $b),
        'checklist_sessions' => scalar($pdo, "SELECT COUNT(DISTINCT sid) FROM events WHERE name = 'checklist_tick' AND $in", $b),
        'summary_copy' => scalar($pdo, "SELECT COUNT(*) FROM events WHERE name = 'summary_copy' AND $in", $b),
        'summary_print' => scalar($pdo, "SELECT COUNT(*) FROM events WHERE name = 'summary_print' AND $in", $b),
        'link_opens' => scalar($pdo, "SELECT COUNT(*) FROM events WHERE name = 'plan_view' AND source = 'link' AND $in", $b),
    ];

    // Health of the product
    $mail = array_column(rows($pdo, "SELECT COALESCE(mail_status,'unknown') s, COUNT(*) n FROM plans WHERE $in GROUP BY s", $b), 'n', 's');
    $health = [
        'mail' => ['sent' => (int) ($mail['sent'] ?? 0), 'failed' => (int) ($mail['failed'] ?? 0), 'pending' => (int) ($mail['pending'] ?? 0)],
        'plans' => $now['plans'], 'deleted' => $now['deleted'],
        'launch_optin_rate' => $now['emails_active'] ? $now['launch_optins'] / $now['emails_active'] : null,
        'ttc_optin_rate' => $now['emails_active'] ? $now['ttc_optins'] / $now['emails_active'] : null,
        'launch_optins' => $now['launch_optins'], 'ttc_optins' => $now['ttc_optins'],
    ];
    $totals = [
        'plans' => scalar($pdo, 'SELECT COUNT(*) FROM plans'),
        'active' => scalar($pdo, 'SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL'),
        'deleted' => scalar($pdo, 'SELECT COUNT(*) FROM plans WHERE deleted_at IS NOT NULL'),
        'launch_optins' => scalar($pdo, 'SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL AND launch_optin = 1'),
    ];

    // Things worth a look
    $alerts = [];
    if ($health['mail']['failed'] > 0) {
        $alerts[] = ['level' => 'warning', 'text' => $health['mail']['failed'] . ' plan email(s) failed to send in this period. Check the mailbox settings in api/config.php.'];
    }
    if ($now['visitors'] === 0 && $now['plans'] > 0) {
        $alerts[] = ['level' => 'info', 'text' => 'Plans were made but no visits were counted. Visit tracking may be blocked, or this period is from before tracking started.'];
    }
    if ($now['completion'] !== null && $before['completion'] !== null && $before['completion'] - $now['completion'] >= 0.1) {
        $alerts[] = ['level' => 'warning', 'text' => 'The share of people who finish the questions fell by ' . round(($before['completion'] - $now['completion']) * 100) . ' points compared with the previous period.'];
    }

    return [
        'range' => ['from' => $from, 'to' => $to, 'days' => $days, 'previous_from' => $prevFrom, 'previous_to' => $prevTo],
        'kpis' => ['current' => $now, 'previous' => $before],
        'series' => $series, 'funnel' => $funnel, 'questions' => $questions,
        'sources' => $sources, 'devices' => $devices, 'symptoms' => $symptoms, 'cta' => $ctaWhere,
        'audience' => $audience, 'care' => $care, 'engagement' => $engagement, 'health' => $health,
        'totals' => $totals, 'alerts' => $alerts, 'min_group' => MIN_GROUP,
    ];
}

// ---------- contacts (second password) ----------
function contacts_list(bool $onlyOptin, string $search): array
{
    $sql = 'SELECT id, name, email, launch_optin, created_at, deleted_at FROM plans';
    $where = [];
    $params = [];
    if ($onlyOptin) {
        $where[] = 'launch_optin = 1 AND deleted_at IS NULL';
    }
    if ($search !== '') {
        $where[] = "deleted_at IS NULL AND (email LIKE :q ESCAPE '\\' OR name LIKE :q ESCAPE '\\')";
        $params[':q'] = '%' . addcslashes($search, '%_\\') . '%';
    }
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $out = [];
    foreach (rows(db(), $sql . ' ORDER BY id DESC LIMIT 2000', $params) as $r) {
        $deleted = $r['deleted_at'] !== null;
        $out[] = [
            'id' => (int) $r['id'], 'status' => $deleted ? 'deleted' : 'active',
            'name' => $deleted ? null : $r['name'], 'email' => $deleted ? null : $r['email'],
            'launch_optin' => !$deleted && (int) $r['launch_optin'] === 1,
            'created_at' => $r['created_at'], 'deleted_at' => $r['deleted_at'],
        ];
    }
    return $out;
}

// A spreadsheet treats cells starting with = + - @ as formulas, so those are defused.
function csv_cell(?string $v): string
{
    $v = (string) $v;
    if ($v !== '' && strpos("=+-@\t\r", $v[0]) !== false) {
        $v = "'" . $v;
    }
    return '"' . str_replace('"', '""', $v) . '"';
}

// Launch list: only people who ticked "Keep me updated" and haven't deleted their plan.
function launch_list_csv(): string
{
    $lines = ['name,email,joined'];
    foreach (contacts_list(true, '') as $c) {
        $lines[] = implode(',', [csv_cell($c['name']), csv_cell($c['email']), csv_cell(substr($c['created_at'], 0, 10))]);
    }
    return implode("\r\n", $lines) . "\r\n";
}
