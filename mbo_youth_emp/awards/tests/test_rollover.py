"""Cycle rollover — awards/services/rollover.py + CycleViewSet.activate.

Contract: rollover creates the next pending_renewal row only; it never touches
current_year_index and never graduates. Re-running the same cycle is a no-op.
Awards with an unresolved latest installment are skipped with a reason.
"""

from django.urls import reverse
from rest_framework.test import APIClient

from schemes.models import Cycle
from awards.models import AwardStatus, InstallmentStatus
from awards.services.rollover import run_cycle_rollover
from notifications.models import Notification

from .base import AwardTestBase


class RolloverTests(AwardTestBase):
    def test_creates_next_installment_pending_renewal(self):
        award = self.make_award()  # year 1 approved on self.cycle

        results = run_cycle_rollover(self.next_cycle)

        self.assertEqual(results['created'], 1)
        inst = award.installments.get(year_index=2)
        self.assertEqual(inst.status, InstallmentStatus.PENDING_RENEWAL)
        self.assertEqual(inst.cycle, self.next_cycle)
        self.assertEqual(str(inst.amount), str(award.annual_amount))
        self.assertEqual(str(inst.threshold), str(award.min_cgpa_snapshot))

        award.refresh_from_db()
        self.assertEqual(award.current_year_index, 0)  # never advances on creation
        self.assertEqual(award.status, AwardStatus.ACTIVE)
        self.assertTrue(award.events.filter(action='renewal.opened').exists())
        self.assertTrue(
            Notification.objects.filter(user=award.student, title='Renewal Open').exists())

    def test_rerun_same_cycle_is_noop(self):
        self.make_award()
        run_cycle_rollover(self.next_cycle)
        results = run_cycle_rollover(self.next_cycle)
        self.assertEqual(results['created'], 0)
        self.assertTrue(results['already_rolled'])

    def test_skips_when_latest_installment_not_settled(self):
        award = self.make_award()
        self.add_installment(award, year_index=2,
                             status=InstallmentStatus.PENDING_VERIFICATION)

        results = run_cycle_rollover(self.next_cycle)

        self.assertEqual(results['created'], 0)
        self.assertTrue(any('pending_verification' in s['reason']
                            for s in results['skipped']))

    def test_skips_suspended_and_graduated_awards(self):
        suspended = self.make_award()
        suspended.status = AwardStatus.SUSPENDED
        suspended.save()
        graduated = self.make_award()
        graduated.status = AwardStatus.GRADUATED
        graduated.save()

        results = run_cycle_rollover(self.next_cycle)

        self.assertEqual(results['created'], 0)

    def test_cycle_must_be_after_latest_installment_cycle(self):
        self.make_award()  # latest is on self.cycle
        results = run_cycle_rollover(self.cycle)  # same cycle
        self.assertEqual(results['created'], 0)
        self.assertTrue(any('not after' in s['reason'] for s in results['skipped']))

    def test_does_not_graduate_on_creating_final_year(self):
        award = self.make_award(total_years=2)  # next year is the last
        run_cycle_rollover(self.next_cycle)
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.ACTIVE)
        self.assertEqual(award.current_year_index, 0)


class CycleActivationTests(AwardTestBase):
    def setUp(self):
        self.client = APIClient()

    def test_activate_rolls_over_and_leaves_one_active_cycle(self):
        award = self.make_award()
        self.client.force_authenticate(user=self.make_staff('admin'))

        resp = self.client.post(
            reverse('cycle-activate', kwargs={'pk': self.next_cycle.pk}))

        self.assertEqual(resp.status_code, 200, resp.data)
        self.next_cycle.refresh_from_db()
        self.assertTrue(self.next_cycle.is_active)
        self.assertIsNotNone(self.next_cycle.activated_at)
        self.assertEqual(Cycle.objects.filter(is_active=True).count(), 1)
        self.assertEqual(resp.data['rollover']['created'], 1)
        self.assertTrue(award.installments.filter(year_index=2).exists())

    def test_create_cycle_does_not_500(self):
        self.client.force_authenticate(user=self.make_staff('admin'))
        resp = self.client.post(
            reverse('cycle-list'),
            {'name': '2028/2029', 'start_year': 2028, 'end_year': 2029},
            format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
