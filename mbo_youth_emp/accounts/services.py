"""External-service integrations for the accounts app.

Currently only Brevo (transactional email) lives here.
"""
from django.conf import settings

import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException


def send_otp_email(to_email: str, code: str) -> None:
    """Send a 6-digit OTP to `to_email` via Brevo's transactional API.

    Raises ApiException on Brevo failure — caller maps to HTTP 502 and avoids
    leaking the provider response to the client.
    """
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
def send_welcome_email(to_email: str, firstname: str) -> None:
    """Send a welcome email after successful account registration."""
    cfg = sib_api_v3_sdk.Configuration()
    cfg.api_key['api-key'] = settings.BREVO_API_KEY
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(cfg))

    api.send_transac_email(sib_api_v3_sdk.SendSmtpEmail(
        sender={"email": settings.BREVO_SENDER_EMAIL, "name": settings.BREVO_SENDER_NAME},
        to=[{"email": to_email}],
        subject="Welcome to RMHCDT Youth Portal",
        html_content=(
            f"<p>Dear {firstname},</p>"
            f"<p>Welcome to the RMHCDT Youth Empowerment Portal. Your account has been created successfully.</p>"
            f"<p>Please verify your email address to activate your account. "
            f"Once verified, your account will be reviewed by an admin before you can apply for any scheme.</p>"
            f"<p>Thank you for registering.</p>"
            f"<p><strong>RMHCDT Team</strong></p>"
        ),
        text_content=(
            f"Dear {firstname},\n\n"
            f"Welcome to the RMHCDT Youth Empowerment Portal. Your account has been created successfully.\n\n"
            f"Please verify your email address to activate your account. "
            f"Once verified, your account will be reviewed by an admin before you can apply for any scheme.\n\n"
            f"Thank you for registering.\n\n"
            f"RMHCDT Team"
        ),
    ))


def send_email_verified_email(to_email: str, firstname: str) -> None:
    """Send an email after the user successfully verifies their email address."""
    cfg = sib_api_v3_sdk.Configuration()
    cfg.api_key['api-key'] = settings.BREVO_API_KEY
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(cfg))

    api.send_transac_email(sib_api_v3_sdk.SendSmtpEmail(
        sender={"email": settings.BREVO_SENDER_EMAIL, "name": settings.BREVO_SENDER_NAME},
        to=[{"email": to_email}],
        subject="Email verified — account pending admin approval",
        html_content=(
            f"<p>Dear {firstname},</p>"
            f"<p>Your email address has been verified successfully.</p>"
            f"<p>Your account is now <strong>pending verification by an admin</strong>. "
            f"You will be notified once your account is approved and you can start applying for available schemes.</p>"
            f"<p>Thank you for your patience.</p>"
            f"<p><strong>RMHCDT Team</strong></p>"
        ),
        text_content=(
            f"Dear {firstname},\n\n"
            f"Your email address has been verified successfully.\n\n"
            f"Your account is now pending verification by an admin. "
            f"You will be notified once your account is approved and you can start applying for available schemes.\n\n"
            f"Thank you for your patience.\n\n"
            f"RMHCDT Team"
        ),
    ))
def send_account_verified_email(to_email: str, firstname: str) -> None:
    """Send an email when admin verifies a student's account."""
    cfg = sib_api_v3_sdk.Configuration()
    cfg.api_key['api-key'] = settings.BREVO_API_KEY
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(cfg))

    api.send_transac_email(sib_api_v3_sdk.SendSmtpEmail(
        sender={"email": settings.BREVO_SENDER_EMAIL, "name": settings.BREVO_SENDER_NAME},
        to=[{"email": to_email}],
        subject="Your account has been verified — you can now apply",
        html_content=(
            f"<p>Dear {firstname},</p>"
            f"<p>Great news! Your account has been <strong>verified</strong> by an RMHCDT admin.</p>"
            f"<p>You can now log in and apply for available schemes and programmes.</p>"
            f"<p>Visit the portal to get started.</p>"
            f"<p><strong>RMHCDT Team</strong></p>"
        ),
        text_content=(
            f"Dear {firstname},\n\n"
            f"Great news! Your account has been verified by an RMHCDT admin.\n\n"
            f"You can now log in and apply for available schemes and programmes.\n\n"
            f"Visit the portal to get started.\n\n"
            f"RMHCDT Team"
        ),
    ))
def send_application_submitted_email(to_email: str, firstname: str, scheme_name: str) -> None:
    """Send a confirmation email when a student submits an application."""
    cfg = sib_api_v3_sdk.Configuration()
    cfg.api_key['api-key'] = settings.BREVO_API_KEY
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(cfg))

    api.send_transac_email(sib_api_v3_sdk.SendSmtpEmail(
        sender={"email": settings.BREVO_SENDER_EMAIL, "name": settings.BREVO_SENDER_NAME},
        to=[{"email": to_email}],
        subject=f"Application received — {scheme_name}",
        html_content=(
            f"<p>Dear {firstname},</p>"
            f"<p>Your application for <strong>{scheme_name}</strong> has been received and is currently under review.</p>"
            f"<p>You will be notified once a decision has been made on your application.</p>"
            f"<p>Thank you for applying.</p>"
            f"<p><strong>RMHCDT Team</strong></p>"
        ),
        text_content=(
            f"Dear {firstname},\n\n"
            f"Your application for {scheme_name} has been received and is currently under review.\n\n"
            f"You will be notified once a decision has been made on your application.\n\n"
            f"Thank you for applying.\n\n"
            f"RMHCDT Team"
        ),
    ))    

__all__ = [
    'send_otp_email',
    'send_password_reset_email',
    'send_welcome_email',
    'send_email_verified_email',
    'send_account_verified_email',
    'send_application_submitted_email',
    'ApiException',
]
