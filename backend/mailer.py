"""Sends the "your care plan" email.

If SMTP_HOST is not set (local development, tests) the email is only logged, so nothing
is ever sent by accident. On Hostinger, use the SMTP details of your Hostinger mailbox,
for example SMTP_HOST=smtp.hostinger.com and SMTP_PORT=465.
"""
import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger("closa.mail")


def build_message(to_email: str, link: str) -> EmailMessage:
    sender = os.environ.get("MAIL_FROM", "Closa Health <hello@closahealth.com>")
    msg = EmailMessage()
    msg["Subject"] = "Your Closa Health care plan"
    msg["From"] = sender
    msg["To"] = to_email
    text = (
        "Hello,\n\n"
        "Your free Closa Health care plan is ready. You can open it any time, and show it to a doctor:\n\n"
        f"{link}\n\n"
        "This plan is guidance based on your answers. It is not a diagnosis. "
        "If you need urgent help, call 112 or go to the nearest hospital emergency unit.\n\n"
        "Anyone with this link can see your plan, so please don't share it publicly. "
        "You can delete your saved plan from the bottom of the plan page, or reply to this email and we will do it for you.\n\n"
        "Closa Health"
    )
    html = (
        '<div style="font-family:Arial,sans-serif;color:#1A1A1A;max-width:520px;line-height:1.5">'
        "<p>Hello,</p>"
        "<p>Your free Closa Health care plan is ready. You can open it any time, and show it to a doctor.</p>"
        f'<p><a href="{link}" style="display:inline-block;background:#4A2545;color:#F7F6F2;'
        'padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:bold">Open my care plan</a></p>'
        "<p style=\"font-size:14px;color:#4a4a4a\">This plan is guidance based on your answers. It is not a diagnosis. "
        "If you need urgent help, call 112 or go to the nearest hospital emergency unit.</p>"
        "<p style=\"font-size:14px;color:#4a4a4a\">Anyone with this link can see your plan, so please don't share it publicly. "
        "You can delete your saved plan from the bottom of the plan page, or reply to this email and we will do it for you.</p>"
        "<p>Closa Health</p></div>"
    )
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


def send_plan_email(to_email: str, link: str) -> bool:
    """Returns True if the email was handed to an SMTP server, False if it was only logged."""
    host = os.environ.get("SMTP_HOST")
    if not host:
        log.info("SMTP_HOST not set, not sending. Plan link for %s: %s", to_email, link)
        return False
    port = int(os.environ.get("SMTP_PORT", "465"))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    msg = build_message(to_email, link)
    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.starttls()
        with server:
            if user:
                server.login(user, password or "")
            server.send_message(msg)
        return True
    except Exception:  # never let a mail problem break saving the plan
        log.exception("Could not send plan email")
        return False
