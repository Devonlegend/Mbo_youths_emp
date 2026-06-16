"""External-service integrations for the accounts app.

Currently only Brevo (transactional email) lives here.
"""
import logging

from django.conf import settings

import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

logger = logging.getLogger(__name__)


def _mock_send(to_email: str, subject: str, code: str) -> bool:
    """When BREVO_MOCK_MODE is on, log the code instead of calling Brevo so
    local development works without a live API key."""
    if getattr(settings, 'BREVO_MOCK_MODE', False):
        logger.info("[MOCK EMAIL] to=%s subject=%r code=%s", to_email, subject, code)
        return True
    return False


def send_otp_email(to_email: str, code: str) -> None:
    """Send a 6-digit OTP to `to_email` via Brevo's transactional API.

    Raises ApiException on Brevo failure — caller maps to HTTP 502 and avoids
    leaking the provider response to the client.
    """
    if _mock_send(to_email, "Your verification code", code):
        return

    cfg = sib_api_v3_sdk.Configuration()
    cfg.api_key['api-key'] = settings.BREVO_API_KEY
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(cfg))

    ttl_minutes = max(1, settings.OTP_TTL_SECONDS // 60)

    api.send_transac_email(sib_api_v3_sdk.SendSmtpEmail(
        sender={"email": settings.BREVO_SENDER_EMAIL, "name": settings.BREVO_SENDER_NAME},
        to=[{"email": to_email}],
        subject="Your verification code",
        html_content=(
            f"<p>Your verification code is:</p>"
            f"<h2 style='letter-spacing:6px;font-family:monospace'>{code}</h2>"
            f"<p>It expires in {ttl_minutes} minutes. "
            f"If you didn't request this, you can ignore this email.</p>"
        ),
        text_content=(
            f"Your verification code is: {code}\n"
            f"It expires in {ttl_minutes} minutes.\n"
            f"If you didn't request this, you can ignore this email."
        ),
    ))


def send_password_reset_email(to_email: str, code: str) -> None:
    """Send a 6-digit password-reset code to `to_email` via Brevo."""
    if _mock_send(to_email, "Reset your password", code):
        return

    cfg = sib_api_v3_sdk.Configuration()
    cfg.api_key['api-key'] = settings.BREVO_API_KEY
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(cfg))

    ttl_minutes = max(1, settings.OTP_TTL_SECONDS // 60)

    api.send_transac_email(sib_api_v3_sdk.SendSmtpEmail(
        sender={"email": settings.BREVO_SENDER_EMAIL, "name": settings.BREVO_SENDER_NAME},
        to=[{"email": to_email}],
        subject="Reset your password",
        html_content=(
            f"<p>We received a request to reset your password. "
            f"Use this code to continue:</p>"
            f"<h2 style='letter-spacing:6px;font-family:monospace'>{code}</h2>"
            f"<p>It expires in {ttl_minutes} minutes. "
            f"If you didn't request a password reset, you can ignore this email.</p>"
        ),
        text_content=(
            f"Your password reset code is: {code}\n"
            f"It expires in {ttl_minutes} minutes.\n"
            f"If you didn't request a password reset, you can ignore this email."
        ),
    ))


__all__ = ['send_otp_email', 'send_password_reset_email', 'ApiException']
