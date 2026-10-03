import logging
from celery import shared_task

from .services.email import EmailService

logger = logging.getLogger(__name__)


def _load_application(application_id, scheme_id):
    """Resolve an application from its per-scheme table.

    Applications live in per-scheme tables, so we need the scheme to know which
    table to read. Returns the row, or None if the scheme/row can't be found
    (logged, not retried — a missing record won't fix itself on retry).
    """
    from schemes.models import ScholarshipScheme
    from applications.dynamic import get_application_model, write_unified

    try:
        scheme = ScholarshipScheme.objects.get(id=scheme_id)
    except ScholarshipScheme.DoesNotExist:
        logger.error(f"[Task Error] Scheme {scheme_id} not found.")
        return None

    if write_unified():
        from applications.models import Application
        row = Application.objects.filter(id=application_id, scheme=scheme).first()
        if row is None:
            logger.error(f"[Task Error] Application {application_id} not found (unified).")
        return row

    model = get_application_model(scheme)
    row = model.objects.filter(id=application_id).first()
    if row is None:
        logger.error(f"[Task Error] Application {application_id} not found in scheme {scheme_id}.")
    return row


# ── Email Tasks ──────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(self, email: str, template_name: str, **kwargs):
    """
    Async email task. Resolves templates and delegates to EmailService.
    """
    try:
        if template_name == "otp":
            otp = kwargs.get("otp")
            result = EmailService.send_otp(email, otp)
        elif template_name == "password_reset":
            otp  = kwargs.get("otp")
            name = kwargs.get("name", email.split('@')[0])
            result = EmailService._send(
                to_email=email,
                subject='Reset your Mbo Portal password',
                template='password_reset',
                context={'otp': otp, 'name': name},
            )
        else:
            result = False

        if not result:
            raise Exception("Email failed to send")

        return result
    except Exception as exc:
        logger.warning(f"Email task failed for {email}. Retrying... Error: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_application_submitted_email(self, application_id: str, scheme_id: str):
    application = _load_application(application_id, scheme_id)
    if application is None:
        return
    try:
        EmailService.send_application_submitted(application)
    except Exception as exc:
        logger.warning(f"Failed to send submission email for App {application_id}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_application_approved_email(self, application_id: str, scheme_id: str):
    application = _load_application(application_id, scheme_id)
    if application is None:
        return
    try:
        EmailService.send_application_approved(application)
    except Exception as exc:
        logger.warning(f"Failed to send approval email for App {application_id}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_application_rejected_email(self, application_id: str, scheme_id: str):
    application = _load_application(application_id, scheme_id)
    if application is None:
        return
    try:
        EmailService.send_application_rejected(application)
    except Exception as exc:
        logger.warning(f"Failed to send rejection email for App {application_id}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_double_dip_flagged_email(self, application_id: str, scheme_id: str):
    application = _load_application(application_id, scheme_id)
    if application is None:
        return
    try:
        EmailService.send_double_dip_flagged(application)
    except Exception as exc:
        logger.warning(f"Failed to send double dip email for App {application_id}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_welcome_email(self, user_id: str):
    """Send welcome email after first OTP verification."""
    from accounts.models import User
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"[Task Error] User {user_id} not found for welcome email.")
        return
    try:
        EmailService.send_welcome(user)
    except Exception as exc:
        logger.warning(f"Failed to send welcome email to {user.email}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_student_verified_email(self, student_id: str):
    """Send verification-approved email after admin verifies a student."""
    from students.models import Student
    try:
        student = Student.objects.get(pk=student_id)
    except Student.DoesNotExist:
        logger.error(f"[Task Error] Student {student_id} not found for verified email.")
        return
    try:
        EmailService.send_student_verified(student)
    except Exception as exc:
        logger.warning(f"Failed to send verified email to student {student_id}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email(self, email: str, otp: str, name: str = ''):
    """Send password reset code via template-based EmailService."""
    try:
        EmailService._send(
            to_email=email,
            subject='Reset your Mbo Portal password',
            template='password_reset',
            context={'otp': otp, 'name': name or email.split('@')[0]},
        )
    except Exception as exc:
        logger.warning(f"Failed to send password reset email to {email}. Retrying...")
        raise self.retry(exc=exc)


# ── Recurring (multi-year) scholarship emails ────────────────────────────────

def _load_award(award_id):
    from awards.models import Award
    award = (Award.objects.select_related('scheme__provider', 'student', 'start_cycle')
             .filter(id=award_id).first())
    if award is None:
        logger.error(f"[Task Error] Award {award_id} not found.")
    return award


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_award_renewal_open_email(self, award_id: str, cycle_id: str, year_index: int):
    from schemes.models import Cycle
    award = _load_award(award_id)
    cycle = Cycle.objects.filter(id=cycle_id).first()
    if award is None or cycle is None:
        return
    try:
        EmailService.send_renewal_open(award, cycle, year_index)
    except Exception as exc:
        logger.warning(f"Failed to send renewal-open email for Award {award_id}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_award_suspended_email(self, award_id: str, reason: str = ''):
    award = _load_award(award_id)
    if award is None:
        return
    try:
        EmailService.send_award_suspended(award, reason)
    except Exception as exc:
        logger.warning(f"Failed to send suspension email for Award {award_id}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_installment_disbursed_email(self, installment_id: str):
    from awards.models import AwardInstallment
    installment = (AwardInstallment.objects
                   .select_related('award__scheme', 'award__student')
                   .filter(id=installment_id).first())
    if installment is None:
        logger.error(f"[Task Error] Installment {installment_id} not found.")
        return
    try:
        EmailService.send_installment_disbursed(installment)
    except Exception as exc:
        logger.warning(f"Failed to send disbursement email for Installment {installment_id}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_award_graduated_email(self, award_id: str):
    award = _load_award(award_id)
    if award is None:
        return
    try:
        EmailService.send_award_graduated(award)
    except Exception as exc:
        logger.warning(f"Failed to send graduation email for Award {award_id}. Retrying...")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_appeal_decision_email(self, appeal_id: str):
    from awards.models import AwardAppeal
    appeal = (AwardAppeal.objects
              .select_related('award__scheme', 'award__student')
              .filter(id=appeal_id).first())
    if appeal is None:
        logger.error(f"[Task Error] Appeal {appeal_id} not found.")
        return
    try:
        EmailService.send_appeal_decision(appeal)
    except Exception as exc:
        logger.warning(f"Failed to send appeal-decision email for Appeal {appeal_id}. Retrying...")
        raise self.retry(exc=exc)
