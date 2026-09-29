"""
Email service for the Mbo LGA Youth Empowerment Portal.

Uses ZeptoMail (by Zoho) for delivery via the `zeptomail` Python SDK.
All emails are rendered from HTML templates using Django's template engine,
so styling and content live in templates/email/*.html — not in Python strings.

Install:  pip install zeptomail
Docs:     https://pypi.org/project/zeptomail/
"""

import logging

from zeptomail import Config, Email, ZeptoMailAPIError

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
        Core send method. Renders template, sends via ZeptoMail.
        Returns True on success. Raises exceptions on network/API failure for Celery retries.
        """
        # Add global context available in every template
        context.update({
            'subject':       subject,
            'portal_url':    getattr(settings, 'PORTAL_URL', 'http://localhost:3000'),
            'support_email': getattr(settings, 'SUPPORT_EMAIL', 'support@mboempowerment.com'),
        })

        try:
            html_content  = render_to_string(f'email/{template}.html', context)
            plain_content = strip_tags(html_content)
        except Exception as e:
            # Template errors are code bugs — retrying won't fix them.
            logger.error(f"[Email] Template render failed for {template}: {e}")
            return False

        if getattr(settings, 'ZEPTO_MOCK_MODE', True):
            cls._mock_send(to_email, subject, plain_content)
            return True

        return cls._zepto_send(to_email, subject, html_content, plain_content)

    @staticmethod
    def _mock_send(to_email: str, subject: str, plain_content: str):
        """Logs to console in development instead of sending real email."""
        logger.info(
            "[MOCK EMAIL] to=%s subject=%r body=%s",
            to_email, subject, plain_content[:300])

    @staticmethod
    def _zepto_send(to_email: str, subject: str,
                    html_content: str, plain_content: str) -> bool:
        """
        Sends via ZeptoMail. Raises Exceptions if the API fails so Celery can retry.
        """
        api_key = settings.ZEPTO_API_KEY.strip()
        if api_key.lower().startswith('zoho-enczapikey '):
            api_key = api_key[len('Zoho-enczapikey '):]
        config = Config(api_key=api_key)
        email  = Email(config)

        try:
            email.send(
                from_=getattr(settings, 'ZEPTO_SENDER_EMAIL', 'no-reply@example.com'),
                from_name=getattr(settings, 'ZEPTO_SENDER_NAME', 'Mbo Youth Empowerment'),
                to=[to_email],
                subject=subject,
                html_body=html_content,
                text_body=plain_content,
            )
            logger.info(f"[Email] ZeptoMail sent '{subject}' to {to_email}")
            return True

        except ZeptoMailAPIError as e:
            logger.error(
                f"[Email] ZeptoMail API error for {to_email}: "
                f"status={e.status_code} body={e.response_body}"
            )
            raise Exception(f"ZeptoMail API Error: {e.status_code}") from e

        except Exception as e:
            logger.error(f"[Email] ZeptoMail send failed to {to_email}: {e}")
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
            template='application_' \
            '' \
            'submitted',
            context={
                'student_name':    student.full_name,
                'scheme_name':     scheme.name,
                'award_type':      scheme.get_award_type_display(),
                'award_amount':    f'{float(scheme.award_amount or 0):,.0f}',
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
                'award_amount':   f'{float(scheme.award_amount or 0):,.0f}',
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
                    # Standardizing string format comparison across choice fields
                    if scheme.get_award_type_display() != conflict.get_award_type_display():
                        conflict_reason = (
                            f'You cannot hold a {scheme.get_award_type_display()} award '
                            f'and a {conflict.get_award_type_display()} award simultaneously'
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

    @classmethod
    def send_student_verified(cls, student) -> bool:
        """Send when admin approves a student's identity verification."""
        return cls._send(
            to_email=student.user.email,
            subject='Your Profile Has Been Verified — Start Applying Now',
            template='student_verified',
            context={
                'student_name': student.full_name,
            }
        )

    # ── Recurring (multi-year) scholarships ──────────────────────────────────

    @classmethod
    def send_renewal_open(cls, award, cycle, year_index) -> bool:
        """Yearly reminder that the next renewal is open."""
        return cls._send(
            to_email=award.student.user.email,
            subject=f'Renewal Open — {award.scheme.name} ({cycle.name})',
            template='renewal_open',
            context={
                'student_name': award.student.full_name,
                'scheme_name':  award.scheme.name,
                'cycle_name':   cycle.name,
                'year_index':   year_index,
                'total_years':  award.total_years,
                'threshold':    f'{float(award.min_cgpa_snapshot):.2f}',
                'award_id':     str(award.id),
            }
        )

    @classmethod
    def send_award_suspended(cls, award, reason='') -> bool:
        """Suspension notice — must include the appeal path."""
        return cls._send(
            to_email=award.student.user.email,
            subject=f'Award Suspended — {award.scheme.name}',
            template='award_suspended',
            context={
                'student_name': award.student.full_name,
                'scheme_name':  award.scheme.name,
                'reason':       reason or 'Not specified',
                'award_id':     str(award.id),
            }
        )

    @classmethod
    def send_installment_disbursed(cls, installment) -> bool:
        """Payment confirmation for one disbursed year."""
        award = installment.award
        return cls._send(
            to_email=award.student.user.email,
            subject=f'Payment Disbursed — {award.scheme.name}',
            template='installment_disbursed',
            context={
                'student_name':     award.student.full_name,
                'scheme_name':      award.scheme.name,
                'year_index':       installment.year_index,
                'total_years':      award.total_years,
                'amount':           f'{float(installment.amount):,.2f}',
                'disbursement_ref': installment.disbursement_ref or '—',
                'disbursed_date':   (installment.disbursed_at.strftime('%d %B %Y')
                                     if installment.disbursed_at else '—'),
                'award_id':         str(award.id),
            }
        )

    @classmethod
    def send_award_graduated(cls, award) -> bool:
        """Congratulation email when the final year is paid."""
        return cls._send(
            to_email=award.student.user.email,
            subject=f'Scholarship Completed — {award.scheme.name}',
            template='award_graduated',
            context={
                'student_name': award.student.full_name,
                'scheme_name':  award.scheme.name,
                'total_years':  award.total_years,
                'award_id':     str(award.id),
            }
        )

    @classmethod
    def send_appeal_decision(cls, appeal) -> bool:
        """Outcome of an award appeal."""
        award = appeal.award
        upheld = appeal.status == 'upheld'
        return cls._send(
            to_email=award.student.user.email,
            subject=(f'Appeal Upheld — {award.scheme.name}' if upheld
                     else f'Appeal Decision — {award.scheme.name}'),
            template='appeal_decision',
            context={
                'student_name': award.student.full_name,
                'scheme_name':  award.scheme.name,
                'upheld':       upheld,
                'review_note':  appeal.review_note or '',
                'award_id':     str(award.id),
            }
        )