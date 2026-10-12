<?php
// Checks answers against the question list, so the server never trusts the browser.
// data/questions_schema.json is generated from the frontend (node scripts/export_schema.mjs).

const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Oyo State'];
const CATEGORIES = ['gp', 'gyn', 'lab', 'haem', 'fp', 'fert'];
// Pregnancy plans are only stored when she ticks the optional consent box.
const TTC_QUESTIONS = ['Q16', 'T1', 'T2', 'T3'];
const EVENT_NAMES = ['plan_action', 'directions_tap'];

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
