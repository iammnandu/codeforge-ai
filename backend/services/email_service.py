"""Email service for sending contest invitations."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from core.config import settings


def send_contest_invite(email: str, contest) -> bool:
    """Send a contest invitation email with join link and code."""
    join_url = f"{settings.FRONTEND_URL}/join/{contest.contest_code}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; padding: 32px;">
        <h2 style="color: #1e1e1e;">You're invited to a coding contest 🚀</h2>
        <p style="color: #555; font-size: 16px;">
          You have been invited to participate in:
        </p>
        <h3 style="color: #6d28d9; font-size: 22px;">{contest.title}</h3>
        <p style="color: #555;">{contest.description or ""}</p>

        <div style="background: #f3f0ff; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #6d28d9; font-weight: bold;">CONTEST CODE</p>
          <p style="margin: 8px 0 0; font-size: 28px; letter-spacing: 4px; font-weight: bold; color: #1e1e1e;">
            {contest.contest_code}
          </p>
        </div>

        <a href="{join_url}"
           style="display: inline-block; background: #6d28d9; color: white;
                  padding: 14px 28px; border-radius: 8px; text-decoration: none;
                  font-size: 16px; font-weight: bold;">
          Join Contest →
        </a>

        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          Start: {contest.start_time.strftime('%d %b %Y, %H:%M UTC')}<br>
          Duration: {contest.duration_minutes} minutes
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #aaa; font-size: 12px;">
          This invitation was sent by CodeForge AI. If you did not expect this email, you can safely ignore it.
        </p>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Contest Invitation: {contest.title}"
    msg["From"] = settings.MAIL_FROM
    msg["To"] = email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
            if settings.MAIL_STARTTLS:
                server.starttls()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_FROM, email, msg.as_string())
        return True
    except Exception as e:
        print(f"[Email] Failed to send to {email}: {e}")
        return False
