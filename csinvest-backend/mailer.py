import smtplib
from email.message import EmailMessage
from config import Config

cfg = Config()


def _smtp_is_configured() -> bool:
    return bool(cfg.SMTP_HOST and cfg.SMTP_PORT and cfg.SMTP_USER and cfg.SMTP_PASSWORD and cfg.SMTP_FROM_EMAIL)


def send_password_reset_code(to_email: str, code: str, username: str | None = None) -> bool:
    if not _smtp_is_configured():
        print("[password-reset] SMTP is not configured; reset email was not sent.")
        return False

    msg = EmailMessage()
    msg["Subject"] = "CS2Invests - Password reset code"
    msg["From"] = cfg.SMTP_FROM_EMAIL
    msg["To"] = to_email
    safe_username = (username or "user").strip() or "user"
    msg.set_content(
        """
Hello {username},

Your CS2Invests password reset code is:

{code}

This code expires in 15 minutes.
If you did not request a password reset, ignore this message.
    """.strip().format(username=safe_username, code=code)
    )

    try:
        if cfg.SMTP_USE_TLS:
            with smtplib.SMTP(cfg.SMTP_HOST, cfg.SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(cfg.SMTP_USER, cfg.SMTP_PASSWORD)
                server.send_message(msg)
            return True

        with smtplib.SMTP_SSL(cfg.SMTP_HOST, cfg.SMTP_PORT, timeout=10) as server:
            server.login(cfg.SMTP_USER, cfg.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as exc:
        print(f"[password-reset] Failed to send reset email: {exc}")
        return False
