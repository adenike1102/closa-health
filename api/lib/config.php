<?php
// Settings. Order of priority: environment variable > api/config.php > default.
// Copy config.example.php to config.php and fill it in (config.php is never committed).

function config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $cfg = [
        'base_url'    => 'https://closahealth.com', // used in the emailed plan link (never taken from the request)
        'db_path'     => '',                         // empty = automatic (see db_path())
        'mail_from'   => 'Closa Health <hello@closahealth.com>',
        'mail_transport' => 'mail',                  // mail | smtp | file (file is for tests)
        'mail_file'   => '',
        'providers_file' => '',                      // empty = data/providers.json
        'smtp_host'   => '',
        'smtp_port'   => 465,
        'smtp_secure' => 'ssl',                      // ssl | tls | none
        'smtp_user'   => '',
        'smtp_password' => '',
    ];
    $file = __DIR__ . '/../config.php';
    if (is_file($file)) {
        $cfg = array_merge($cfg, (array) require $file);
    }
    $env = [
        'CLOSA_BASE_URL' => 'base_url', 'CLOSA_DB' => 'db_path', 'CLOSA_MAIL_TRANSPORT' => 'mail_transport',
        'CLOSA_MAIL_FILE' => 'mail_file', 'CLOSA_PROVIDERS_FILE' => 'providers_file', 'CLOSA_SMTP_HOST' => 'smtp_host', 'CLOSA_SMTP_PORT' => 'smtp_port',
        'CLOSA_SMTP_SECURE' => 'smtp_secure', 'CLOSA_SMTP_USER' => 'smtp_user', 'CLOSA_SMTP_PASSWORD' => 'smtp_password',
    ];
    foreach ($env as $name => $key) {
        $v = getenv($name);
        if ($v !== false && $v !== '') {
            $cfg[$key] = $v;
        }
    }
    return $cfg;
}
