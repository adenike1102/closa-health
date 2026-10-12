<?php
// Copy this file to config.php (same folder) and fill it in.
// Create the mailbox hello@closahealth.com in hPanel > Emails first.
return [
    'base_url'       => 'https://closahealth.com',
    'mail_from'      => 'Closa Health <hello@closahealth.com>',
    'mail_transport' => 'smtp',               // 'smtp' (recommended) or 'mail' (PHP's built-in mail())
    'smtp_host'      => 'smtp.hostinger.com',
    'smtp_port'      => 465,
    'smtp_secure'    => 'ssl',
    'smtp_user'      => 'hello@closahealth.com',
    'smtp_password'  => 'the mailbox password',
];
