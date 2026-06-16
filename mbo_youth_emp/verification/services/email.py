"""
Email service for the Mbo LGA Youth Empowerment Portal.

Uses Brevo (formerly Sendinblue) for delivery via their official Python SDK.
All emails are rendered from HTML templates using Django's template engine,
so styling and content live in templates/email/*.html — not in Python strings.

Install:  pip install sib-api-v3-sdk
Docs:     https://github.com/sendinblue/APIv3-python-library
"""

import logging
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class EmailService:

    # ── Internal sender ──────────────────────────────────────────────────────

    @classmethod
    def _send(cls, to_email: str, subject: str, template: str, context: dict) -> bool:
        """
        Core send method. Renders template, sends via Brevo.
        Returns True on success. Raises exceptions on network/API failure for Celery retries.
        """
        # Add global context available in every template
        context.update({
            'subject':    subject,
            'portal_url': getattr(settings, 'PORTAL_URL', 'http://localhost:3000'),
        })

        try:
            html_content  = render_to_string(f'email/{template}.html', context)
            plain_content = strip_tags(html_content)
        except Exception as e:
            # Template errors are code bugs — retrying won't fix them.
            logger.error(f"[Email] Template render failed for {template}: {e}")
            return False

        if getattr(settings, 'BREVO_MOCK_MODE', True):
            cls._mock_send(to_email, subject, plain_content)
            return True

        return cls._brevo_send(to_email, subject, html_content, plain_content)

    @staticmethod
    def _mock_send(to_email: str, subject: str, plain_content: str):
        """Logs to console in development instead of sending real email."""
        logger.info(
            "[MOCK EMAIL] to=%s subject=%r body=%s",
            to_email, subject, plain_content[:300])

    @staticmethod
    def _brevo_send(to_email: str, subject: str,
                    html_content: str, plain_content: str) -> bool:
        """
        Sends via Brevo. Raises Exceptions if the API fails so Celery can retry.
        """
        import sib_api_v3_sdk
        from sib_api_v3_sdk.rest import ApiException

        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = settings.BREVO_API_KEY

        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )

        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{'email': to_email}],
            sender={
                'email': getattr(settings, 'BREVO_SENDER_EMAIL', 'no-reply@example.com'),
                'name':  getattr(settings, 'BREVO_SENDER_NAME', 'Mbo Youth Empowerment'),
            },
            subject      = subject,
            html_content = html_content,
            text_content = plain_content,
            tags=['mbo-lga', 'youth-empowerment'],
        )

        try:
            api_instance.send_transac_email(send_smtp_email)
            logger.info(f"[Email] Brevo sent '{subject}' to {to_email}")
            return True

        except ApiException as e:
            logger.error(f"[Email] Brevo API error for {to_email}: status={e.status} body={e.body}")
            raise Exception(f"Brevo API Error: {e.status}") from e

        except Exception as e:
            logger.error(f"[Email] Brevo send failed to {to_email}: {e}")
            raise e

    # ── Public methods — one per email event ─────────────────────────────────

    @classmethod
    def send_otp(cls, email: str, otp: str) -> bool:
        return cls._send(
            to_email=email,
            subject=f'{otp} is your Mbo Portal verification code',
            template='otp',
            context={
                'email': email,
                'otp':   otp,
            }
        )

    @classmethod
    def send_welcome(cls, user) -> bool:
        return cls._send(
            to_email=user.email,
            subject='Welcome to the Mbo LGA Youth Empowerment Portal',
            template='welcome',
            context={
                'email':           user.email,
                'registered_date': timezone.now().strftime('%d %B %Y'),
            }
        )

    @classmethod
    def send_application_submitted(cls, application) -> bool:
        student = application.student
        scheme  = application.scheme

        return cls._send(
            to_email=student.user.email,
            subject=f'Application Received — {scheme.name}',
            template='application_submitted',
            context={
                'student_name':    student.full_name,
                'scheme_name':     scheme.name,
                'award_type':      scheme.get_award_type_display(),
                'award_amount':    f'{float(scheme.award_amount):,.0f}',
                'provider_name':   scheme.provider.name,
                'academic_year':   scheme.academic_year,
                'submission_date': application.submission_date.strftime('%d %B %Y, %I:%M %p')
                                   if application.submission_date else '—',
                'reference':       str(application.id)[:8].upper(),
            }
        )

    @classmethod
    def send_application_approved(cls, application) -> bool:
        student = application.student
        scheme  = application.scheme

        return cls._send(
            to_email=student.user.email,
            subject=f'Congratulations — Your {scheme.name} Award Has Been Approved',
            template='application_approved',
            context={
                'student_name':   student.full_name,
                'scheme_name':    scheme.name,
                'award_type':     scheme.get_award_type_display(),
                'award_amount':   f'{float(scheme.award_amount):,.0f}',
                'provider_name':  scheme.provider.name,
                'academic_year':  scheme.academic_year,
                'approved_date':  timezone.now().strftime('%d %B %Y'),
                'reviewer_notes': application.reviewer_notes or '',
                'reference':      str(application.id)[:8].upper(),
            }
        )

    @classmethod
    def send_application_rejected(cls, application) -> bool:
        student = application.student
        scheme  = application.scheme

        return cls._send(
            to_email=student.user.email,
            subject=f'Application Update — {scheme.name}',
            template='application_rejected',
            context={
                'student_name':     student.full_name,
                'scheme_name':      scheme.name,
                'award_type':       scheme.get_award_type_display(),
                'provider_name':    scheme.provider.name,
                'academic_year':    scheme.academic_year,
                'rejection_reason': application.rejection_reason or '',
                'decision_date':    timezone.now().strftime('%d %B %Y'),
                'reference':        str(application.id)[:8].upper(),
            }
        )

    @classmethod
    def send_double_dip_flagged(cls, application) -> bool:
        student  = application.student
        scheme   = application.scheme

        conflicting_name   = 'an existing active award'
        conflict_reason    = 'Multiple benefit conflict'
        conflict_scheme_ids = application.conflict_scheme_ids or []

        if conflict_scheme_ids:
            try:
                from schemes.models import ScholarshipScheme
                conflict = ScholarshipScheme.objects.filter(id=conflict_scheme_ids[0]).first()
                if conflict:
                    conflicting_name = conflict.name
                    if scheme.award_type != conflict.award_type:
                        conflict_reason = (
                            f'You cannot hold a {scheme.award_type} award '
                            f'and a {conflict.award_type} award simultaneously'
                        )
                    else:
                        conflict_reason = 'Stacking policy — both awards exceed the major award threshold'
            except Exception:
                pass

        return cls._send(
            to_email=student.user.email,
            subject=f'Action Required — Award Conflict on Your {scheme.name} Application',
            template='double_dip_flagged',
            context={
                'student_name':       student.full_name,
                'scheme_name':        scheme.name,
                'award_type':         scheme.get_award_type_display(),
                'conflicting_scheme': conflicting_name,
                'conflict_reason':    conflict_reason,
                'academic_year':      scheme.academic_year,
                'reference':          str(application.id)[:8].upper(),
            }
        )
