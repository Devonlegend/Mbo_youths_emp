"""Time-based expiry — awards/services/expiry.py + the expire_renewals command.

Grace expiry cancels an unsubmitted renewal and suspends the award, leaving
current_year_index on the last paid year. Appeal expiry terminates a suspended
award only when an appealable installment exists and no appeal is pending.
"""

import io
from datetime import timedelta

from django.core.management import call_command
from django.utils import timezone

from awards.models import (
    AppealStatus,
    AwardAppeal,
    AwardStatus,
    InstallmentStatus,
)
from awards.services.expiry import (
    APPEAL_WINDOW_DAYS,
    GRACE_DAYS,
    expire_appeals,
    expire_overdue_renewals,
)
from awards.tasks import expire_awards

from .base import AwardTestBase


class GraceExpiryTests(AwardTestBase):
    def _awaiting_award(self, days_ago):
        award = self.make_award()
        self.cycle.activated_at = timezone.now() - timedelta(days=days_ago)
        self.cycle.save(update_fields=['activated_at'])
        self.add_installment(award, year_index=2,
                             status=InstallmentStatus.PENDING_RENEWAL,
                             cycle=self.cycle)
        return award

    def test_cancels_and_suspends_after_grace(self):
        award = self._awaiting_award(GRACE_DAYS + 1)

        results = expire_overdue_renewals()

        self.assertEqual(results['cancelled'], 1)
        self.assertEqual(results['suspended'], 1)
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.SUSPENDED)
        self.assertEqual(
            award.installments.get(year_index=2).status, InstallmentStatus.CANCELLED)
        self.assertEqual(award.current_year_index, 0)  # stays on last paid year

    def test_not_cancelled_before_grace(self):
        award = self._awaiting_award(10)
        self.assertEqual(expire_overdue_renewals()['cancelled'], 0)
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.ACTIVE)

    def test_ignores_installments_without_cycle_activation(self):
        award = self.make_award()
        self.add_installment(award, year_index=2,
                             status=InstallmentStatus.PENDING_RENEWAL,
                             cycle=self.cycle)  # no activated_at
        self.assertEqual(expire_overdue_renewals()['cancelled'], 0)
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.ACTIVE)


class AppealExpiryTests(AwardTestBase):
    def _suspended(self, days_ago, pending_appeal=False, appealable=True):
        award = self.make_award()
        award.status = AwardStatus.SUSPENDED
        award.suspended_at = timezone.now() - timedelta(days=days_ago)
        award.save()
        if appealable:
            inst = self.add_installment(award, year_index=2,
                                        status=InstallmentStatus.WITHHELD)
            if pending_appeal:
                AwardAppeal.objects.create(award=award, installment=inst,
                                           reason='x')
        return award

    def test_terminates_after_window_without_appeal(self):
        award = self._suspended(APPEAL_WINDOW_DAYS + 1)
        self.assertEqual(expire_appeals()['terminated'], 1)
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.TERMINATED)

    def test_pending_appeal_prevents_termination(self):
        award = self._suspended(APPEAL_WINDOW_DAYS + 1, pending_appeal=True)
        self.assertEqual(expire_appeals()['terminated'], 0)
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.SUSPENDED)

    def test_before_window_not_terminated(self):
        self._suspended(5)
        self.assertEqual(expire_appeals()['terminated'], 0)

    def test_manual_suspension_without_unresolved_installment_survives(self):
        award = self._suspended(APPEAL_WINDOW_DAYS + 1, appealable=False)
        self.assertEqual(expire_appeals()['terminated'], 0)
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.SUSPENDED)


class ExpireCommandTests(AwardTestBase):
    def _overdue(self):
        award = self.make_award()
        self.cycle.activated_at = timezone.now() - timedelta(days=GRACE_DAYS + 1)
        self.cycle.save(update_fields=['activated_at'])
        self.add_installment(award, year_index=2,
                             status=InstallmentStatus.PENDING_RENEWAL,
                             cycle=self.cycle)
        return award

    def test_dry_run_writes_nothing(self):
        award = self._overdue()
        call_command('expire_renewals', '--dry-run', stdout=io.StringIO())
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.ACTIVE)

    def test_command_applies_changes(self):
        award = self._overdue()
        call_command('expire_renewals', stdout=io.StringIO())
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.SUSPENDED)


class ExpireTaskTests(AwardTestBase):
    """The periodic Celery task (beat entrypoint) — same work as the command."""

    def test_task_suspends_overdue_renewal(self):
        award = self.make_award()
        self.cycle.activated_at = timezone.now() - timedelta(days=GRACE_DAYS + 1)
        self.cycle.save(update_fields=['activated_at'])
        self.add_installment(award, year_index=2,
                             status=InstallmentStatus.PENDING_RENEWAL,
                             cycle=self.cycle)

        result = expire_awards.apply().get()

        self.assertEqual(result['renewals_cancelled'], 1)
        self.assertEqual(result['awards_suspended'], 1)
        self.assertEqual(result['appeal_windows_expired'], 0)
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.SUSPENDED)
