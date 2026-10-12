<?php
// Sends the "your care plan" email.
//   mail_transport = smtp : your Hostinger mailbox (recommended, best delivery)
//   mail_transport = mail : PHP's built-in mail()
//   mail_transport = file : appends the message to mail_file (tests and local development)
// A mail problem never stops the plan being saved; it is only logged.

function plan_message(string $to, string $link): array
{
    $text = "Hello,\r\n\r\n"
        . "Your free Closa Health care plan is ready. You can open it any time, and show it to a doctor:\r\n\r\n"
        . "$link\r\n\r\n"
        . "This plan is guidance based on your answers. It is not a diagnosis. "
        . "If you need urgent help, call 112 or go to the nearest hospital emergency unit.\r\n\r\n"
        . "Anyone with this link can see your plan, so please don't share it publicly. "
        . "You can delete your saved plan from the bottom of the plan page, or reply to this email and we will do it for you.\r\n\r\n"
        . "Closa Health\r\n";
    $safe = htmlspecialchars($link, ENT_QUOTES);
    $html = '<div style="font-family:Arial,sans-serif;color:#1A1A1A;max-width:520px;line-height:1.5">'
        . '<p>Hello,</p><p>Your free Closa Health care plan is ready. You can open it any time, and show it to a doctor.</p>'
        . '<p><a href="' . $safe . '" style="display:inline-block;background:#4A2545;color:#F7F6F2;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:bold">Open my care plan</a></p>'
        . '<p style="font-size:14px;color:#4a4a4a">This plan is guidance based on your answers. It is not a diagnosis. If you need urgent help, call 112 or go to the nearest hospital emergency unit.</p>'
        . '<p style="font-size:14px;color:#4a4a4a">Anyone with this link can see your plan, so please don\'t share it publicly. You can delete your saved plan from the bottom of the plan page, or reply to this email and we will do it for you.</p>'
        . '<p>Closa Health</p></div>';
    $boundary = 'closa_' . bin2hex(random_bytes(8));
    $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$text\r\n"
        . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$html\r\n"
        . "--$boundary--\r\n";
    $headers = "MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"$boundary\"";
    return ['subject' => 'Your Closa Health care plan', 'headers' => $headers, 'body' => $body];
}

function mail_address(string $from): string
{
    return preg_match('/<([^>]+)>/', $from, $m) ? $m[1] : trim($from);
}

// Returns true if the message was handed over to a mail system.
function send_plan_email(string $to, string $link): bool
{
    $c = config();
    $from = $c['mail_from'];
    $m = plan_message($to, $link);
    try {
        switch ($c['mail_transport']) {
            case 'file':
                file_put_contents($c['mail_file'], json_encode(['to' => $to, 'link' => $link, 'body' => $m['body']]) . "\n", FILE_APPEND);
                return true;
            case 'smtp':
                $raw = "From: $from\r\nTo: $to\r\nSubject: {$m['subject']}\r\nDate: " . date('r')
                    . "\r\nMessage-ID: <" . bin2hex(random_bytes(8)) . '@' . (parse_url($c['base_url'], PHP_URL_HOST) ?: 'localhost') . ">\r\n"
                    . $m['headers'] . "\r\n\r\n" . $m['body'];
                smtp_send($c, mail_address($from), $to, $raw);
                return true;
            default:
                return mail($to, $m['subject'], $m['body'], "From: $from\r\nReply-To: " . mail_address($from) . "\r\n" . $m['headers'], '-f' . mail_address($from));
        }
    } catch (Throwable $e) {
        error_log('Closa: could not send plan email: ' . $e->getMessage());
        return false;
    }
}

// A very small SMTP client: enough to log in and send one message.
function smtp_send(array $c, string $fromAddr, string $to, string $raw): void
{
    $secure = $c['smtp_secure'];
    $scheme = $secure === 'ssl' ? 'ssl://' : 'tcp://';
    $fp = @stream_socket_client($scheme . $c['smtp_host'] . ':' . (int) $c['smtp_port'], $errno, $errstr, 15);
    if (!$fp) {
        throw new RuntimeException("SMTP connect failed: $errstr");
    }
    stream_set_timeout($fp, 15);
    $read = function () use ($fp): string {
        $out = '';
        while (($line = fgets($fp, 515)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }
        return $out;
    };
    $expect = function (string $reply, array $ok) {
        if (!in_array(substr($reply, 0, 3), $ok, true)) {
            throw new RuntimeException('SMTP error: ' . trim($reply));
        }
    };
    $send = function (string $line, array $ok) use ($fp, $read, $expect) {
        fwrite($fp, $line . "\r\n");
        $expect($read(), $ok);
    };
    $host = parse_url($c['base_url'], PHP_URL_HOST) ?: 'localhost';
    try {
        $expect($read(), ['220']);
        $send("EHLO $host", ['250']);
        if ($secure === 'tls') {
            $send('STARTTLS', ['220']);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('SMTP STARTTLS failed');
            }
            $send("EHLO $host", ['250']);
        }
        if ($c['smtp_user'] !== '') {
            $send('AUTH LOGIN', ['334']);
            $send(base64_encode($c['smtp_user']), ['334']);
            $send(base64_encode($c['smtp_password']), ['235']);
        }
        $send("MAIL FROM:<$fromAddr>", ['250']);
        $send("RCPT TO:<$to>", ['250', '251']);
        $send('DATA', ['354']);
        fwrite($fp, preg_replace('/^\./m', '..', $raw) . "\r\n.\r\n");
        $expect($read(), ['250']);
        fwrite($fp, "QUIT\r\n");
    } finally {
        fclose($fp);
    }
}
