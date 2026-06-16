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
    from applications.dynamic import get_application_model

    try:
        scheme = ScholarshipScheme.objects.get(id=scheme_id)
    except ScholarshipScheme.DoesNotExist:
        logger.error(f"[Task Error] Scheme {scheme_id} not found.")
        return None

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
