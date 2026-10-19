<?php
// Checks answers against the question list, so the server never trusts the browser.
// data/questions_schema.json is generated from the frontend (node scripts/export_schema.mjs).

const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Oyo State'];
const CATEGORIES = ['gp', 'gyn', 'lab', 'haem', 'fp', 'fert'];
// Pregnancy plans are only stored when she ticks the optional consent box.
const TTC_QUESTIONS = ['Q16', 'T1', 'T2', 'T3'];
// Events the browser may send. plan_created and plan_delete are recorded by the server only.
const EVENT_NAMES = [
    'plan_action', 'directions_tap', 'session_start', 'cta_click', 'symptom_pick', 'question_view', 'safety_screen',
    'csv_upload', 'email_view', 'plan_view', 'provider_view', 'checklist_tick', 'summary_copy', 'summary_print',
];

function schema(): array
{
    static $s = null;
    return $s ??= json_decode(file_get_contents(__DIR__ . '/../data/questions_schema.json'), true);
}

// Returns the tidy answers, or throws InvalidArgumentException with a message.
function clean_answers(mixed $answers): array
{
    if (!is_array($answers)) {
        throw new InvalidArgumentException('answers must be an object');
    }
    $schema = schema();
    $clean = [];
    foreach ($answers as $qid => $value) {
        $qid = (string) $qid;
        if (!isset($schema[$qid])) {
            throw new InvalidArgumentException("Unknown question $qid");
        }
        $codes = $schema[$qid]['codes'];
        if ($schema[$qid]['type'] === 'single') {
            if (!is_string($value) || !in_array($value, $codes, true)) {
                throw new InvalidArgumentException("Invalid answer for $qid");
            }
            $clean[$qid] = $value;
        } else {
            if (!is_array($value) || !array_is_list($value)) {
                throw new InvalidArgumentException("Invalid answer for $qid");
            }
            foreach ($value as $v) {
                if (!is_string($v) || !in_array($v, $codes, true)) {
                    throw new InvalidArgumentException("Invalid answer for $qid");
                }
            }
            $unique = array_values(array_unique($value));
            if ($unique) {
                $clean[$qid] = $unique;
            }
        }
    }
    if (empty($clean['Q1'])) {
        throw new InvalidArgumentException('Q1 is required');
    }
    return $clean;
}

function clean_email(mixed $email): string
{
    if (!is_string($email)) {
        throw new InvalidArgumentException('Enter a valid email address');
    }
    $email = strtolower(trim($email));
    // \S also rules out spaces and line breaks, which stops header injection in the email we send.
    if (strlen($email) > 254 || !preg_match('/^\S+@\S+\.\S+$/', $email)) {
        throw new InvalidArgumentException('Enter a valid email address');
    }
    return $email;
}

// ---------- newer fields ----------

// The "what should we call you?" name is optional. Returns null when empty.
function clean_name(mixed $name): ?string
{
    if ($name === null || $name === '') {
        return null;
    }
    if (!is_string($name)) {
        throw new InvalidArgumentException('name must be text');
    }
    $name = trim(preg_replace('/\s+/u', ' ', preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?? '') ?? '');
    if ($name === '') {
        return null;
    }
    if (mb_strlen($name) > 60) {
        throw new InvalidArgumentException('name is too long');
    }
    return $name;
}

// Anonymous visitor code made in the browser. Anything that doesn't look right is ignored.
function clean_sid(mixed $sid): ?string
{
    return is_string($sid) && preg_match('/^[A-Za-z0-9]{12,40}$/', $sid) ? $sid : null;
}

// The care plan summary worked out in the browser. Only known values are kept; the rest is dropped,
// and a bad summary never stops a plan being saved (it is only used for the dashboard).
function clean_outcome(mixed $o): ?array
{
    if (!is_array($o) || !isset($o['urgency']) || !is_int($o['urgency']) || $o['urgency'] < 1 || $o['urgency'] > 5) {
        return null;
    }
    $list = function ($v, callable $ok): array {
        if (!is_array($v)) {
            return [];
        }
        $out = [];
        foreach (array_slice($v, 0, 40) as $item) {
            if (is_string($item) && $ok($item)) {
                $out[] = $item;
            }
        }
        return array_values(array_unique($out));
    };
    $safetyCodes = schema()['Q0']['codes'];
    return [
        'urgency' => $o['urgency'],
        'flags'   => $list($o['flags'] ?? [], fn($s) => (bool) preg_match('/^F-[A-Z]{2,12}$/', $s)),
        'who'     => $list($o['who'] ?? [], fn($s) => in_array($s, array_merge(CATEGORIES, ['emerg']), true)),
        'tests'   => $list($o['tests'] ?? [], fn($s) => (bool) preg_match('/^T-[A-Z]{2,12}$/', $s)),
        'safety'  => $list($o['safety'] ?? [], fn($s) => $s !== 'none' && in_array($s, $safetyCodes, true)),
    ];
}

// Short free-text tags (campaign names, referrers). Returns null for empty or unsafe values.
function clean_tag(mixed $v, int $max = 60): ?string
{
    if (!is_string($v)) {
        return null;
    }
    $v = trim(preg_replace('/[\x00-\x1F\x7F<>"\']/u', '', $v) ?? '');
    return $v === '' ? null : mb_substr($v, 0, $max);
}
