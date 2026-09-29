"""Time-based transitions — the two timers the renewal engine needs.

Run periodically (cron / Task Scheduler / celery-beat) via the
``expire_renewals`` management command:

* **Grace expiry** — an installment still ``pending_renewal`` after
  ``RENEWAL_GRACE_DAYS`` past its cycle's activation is cancelled and the
  award suspended ("No renewal submitted"). Because ``current_year_index``
  advances on disbursement only, the award correctly stays on the last *paid*
  year.
* **Appeal window** — a suspended award with an appealable installment and no
  pending appeal ``APPEAL_WINDOW_DAYS`` after ``suspended_at`` is terminated.

Both are individually savepoint-isolated so one failure never aborts the batch.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from notifications.helpers import notify_award_suspended

from ..models import (
    AppealStatus,
    Award,
    AwardEvent,
    AwardInstallment,
    AwardStatus,
    InstallmentStatus,
)
from .lifecycle import terminate_award

logger = logging.getLogger(__name__)

GRACE_DAYS        = getattr(settings, 'RENEWAL_GRACE_DAYS', 56)
APPEAL_WINDOW_DAYS = getattr(settings, 'APPEAL_WINDOW_DAYS', 60)

_APPEALABLE = (InstallmentStatus.WITHHELD, InstallmentStatus.CANCELLED)


def expire_overdue_renewals(now=None):
    """Cancel pending_renewal installments past the grace window and suspend
    their awards. Returns ``{cancelled, suspended}``."""
    now = now or timezone.now()
    cutoff = now - timedelta(days=GRACE_DAYS)

    results = {'cancelled': 0, 'suspended': 0}
    qs = (
        AwardInstallment.objects
        .filter(status=InstallmentStatus.PENDING_RENEWAL,
                cycle__activated_at__isnull=False,
                cycle__activated_at__lt=cutoff)
        .select_related('award__student', 'award__scheme', 'cycle')
    )

    suspended_awards = []
    for installment in qs:
        try:
            with transaction.atomic():
                award = installment.award
                installment.status = InstallmentStatus.CANCELLED
                installment.save(update_fields=['status', 'updated_at'])
                results['cancelled'] += 1

                if award.status == AwardStatus.ACTIVE:
                    award.status = AwardStatus.SUSPENDED
                    award.suspended_reason = 'No renewal submitted'
                    award.suspended_at = now
                    award.save(update_fields=['status', 'suspended_reason',
                                              'suspended_at', 'updated_at'])
                    results['suspended'] += 1
                    suspended_awards.append(award)

                AwardEvent.objects.create(
                    award=award, actor=None, action='renewal.expired',
                    note=(f'year {installment.year_index}: no submission within '
                          f'{GRACE_DAYS} days'),
                )
        except Exception:
            logger.exception('Grace expiry failed for installment %s',
                             installment.id)

    for award in suspended_awards:
        try:
            notify_award_suspended(award, 'No renewal submitted')
        except Exception:
            logger.exception('Grace-expiry notification failed for award %s',
                             award.id)

    return results


def expire_appeals(now=None):
    """Terminate suspended awards with an appealable installment whose appeal
    window has lapsed and which have no pending appeal. Returns
    ``{terminated}``."""
    now = now or timezone.now()
    cutoff = now - timedelta(days=APPEAL_WINDOW_DAYS)

    results = {'terminated': 0}
    awards = (
        Award.objects
        .filter(status=AwardStatus.SUSPENDED, suspended_at__lt=cutoff)
        .select_related('student', 'scheme')
        .prefetch_related('installments', 'appeals')
    )

    for award in awards:
        try:
            if any(a.status == AppealStatus.PENDING for a in award.appeals.all()):
                continue
            if not any(i.status in _APPEALABLE for i in award.installments.all()):
                continue  # nothing the student could have appealed
            with transaction.atomic():
                terminate_award(award=award, actor=None,
                                reason='Appeal window expired')
                results['terminated'] += 1
        except Exception:
            logger.exception('Appeal expiry failed for award %s', award.id)

    return results
