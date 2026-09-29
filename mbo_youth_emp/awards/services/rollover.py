"""Cycle rollover — the yearly renewal engine.

When an admin activates a new cycle, every ACTIVE award whose latest
installment is settled (approved/disbursed) gets a ``pending_renewal`` row for
the next payment year.

Rules that make or break this engine (RECURRING_SCHOLARSHIPS_PLAN.md §3.3):

* ``current_year_index`` advances on **disbursement only** — rollover never
  touches it, and rollover **never graduates** an award.
* Only awards whose latest installment is ``approved``/``disbursed`` roll
  forward; anything unresolved (``pending_verification``/``withheld``/
  ``pending_renewal``) is skipped with a reason so one award can't hold two
  open installments.
* Each renewal is locked to the award's **successor cycle**: a cycle whose
  start year is not after the latest installment's cycle creates nothing, so
  activating the wrong cycle can't orphan a payable year.
* Per-award savepoints: one bad award is logged and skipped, never aborting
  the batch.
"""

import logging

from django.db import transaction

from notifications.helpers import build_renewal_open_notification
from notifications.models import Notification

from .dispatch import dispatch_email
from ..models import (
    Award,
    AwardEvent,
    AwardInstallment,
    AwardStatus,
    InstallmentStatus,
)

logger = logging.getLogger(__name__)

# A renewal rolls forward only from a settled previous year.
RENEWABLE_LATEST = (InstallmentStatus.APPROVED, InstallmentStatus.DISBURSED)


def _latest_installment(award):
    installments = list(award.installments.all())
    if not installments:
        return None
    return max(installments, key=lambda i: i.year_index)


def run_cycle_rollover(new_cycle):
    """Open the next installment for every eligible active award.

    Returns a summary dict::

        {cycle, created, skipped: [{award_id, reason}], failed, already_rolled}

    Idempotent: re-running the same cycle creates nothing and reports
    ``already_rolled=True``.
    """
    results = {
        'cycle':          new_cycle.name,
        'created':        0,
        'skipped':        [],
        'failed':         0,
        'already_rolled': False,
    }

    awards = (
        Award.objects
        .filter(status=AwardStatus.ACTIVE)
        .select_related('scheme', 'student')
        .prefetch_related('installments__cycle')
    )

    notifications = []
    email_jobs    = []

    for award in awards:
        try:
            with transaction.atomic():  # per-award savepoint
                latest = _latest_installment(award)

                if latest is None:
                    results['skipped'].append(
                        {'award_id': str(award.id), 'reason': 'no installments'})
                    continue

                if latest.status not in RENEWABLE_LATEST:
                    results['skipped'].append({
                        'award_id': str(award.id),
                        'reason':   f'latest installment is {latest.status}',
                    })
                    continue

                if latest.year_index >= award.total_years:
                    results['skipped'].append({
                        'award_id': str(award.id),
                        'reason':   'award already complete',
                    })
                    continue

                next_index = latest.year_index + 1
                if any(i.year_index == next_index for i in award.installments.all()):
                    results['skipped'].append({
                        'award_id': str(award.id),
                        'reason':   'next installment already exists',
                    })
                    continue

                if (latest.cycle_id is None
                        or new_cycle.start_year <= latest.cycle.start_year):
                    results['skipped'].append({
                        'award_id': str(award.id),
                        'reason':   'cycle is not after the latest installment cycle',
                    })
                    continue

                AwardInstallment.objects.create(
                    award=award,
                    year_index=next_index,
                    cycle=new_cycle,
                    amount=award.annual_amount,
                    threshold=award.min_cgpa_snapshot,
                    status=InstallmentStatus.PENDING_RENEWAL,
                )
                AwardEvent.objects.create(
                    award=award, actor=None, action='renewal.opened',
                    note=f'{new_cycle.name} year {next_index}',
                )
                notifications.append(
                    build_renewal_open_notification(award, new_cycle, next_index))
                email_jobs.append((str(award.id), str(new_cycle.id), next_index))
                results['created'] += 1

        except Exception:
            logger.exception('Rollover failed for award %s', award.id)
            results['failed'] += 1
            continue

    if notifications:
        Notification.objects.bulk_create(notifications)

    if email_jobs:
        from verification.tasks import send_award_renewal_open_email
        for award_id, cycle_id, year_index in email_jobs:
            dispatch_email(send_award_renewal_open_email, award_id=award_id,
                           cycle_id=cycle_id, year_index=year_index)

    results['already_rolled'] = results['created'] == 0
    return results
