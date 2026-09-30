"""Celery tasks for awards.

Only the periodic expiry job lives here — every other award transition is
triggered by a request. Scheduled from ``config/celery.py`` (beat) and also
runnable directly via ``manage.py expire_renewals``.
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def expire_awards():
    """Cancel overdue renewals and expire lapsed appeal windows.

    Returns a small summary so the beat log shows what happened each run.
    """
    from .services.expiry import expire_appeals, expire_overdue_renewals

    renewals = expire_overdue_renewals()
    appeals  = expire_appeals()

    result = {
        'renewals_cancelled':     renewals['cancelled'],
        'awards_suspended':       renewals['suspended'],
        'appeal_windows_expired': appeals['terminated'],
    }
    logger.info('expire_awards: %s', result)
    return result
