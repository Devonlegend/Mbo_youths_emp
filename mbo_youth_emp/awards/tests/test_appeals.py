"""Appeals — the breach-recovery path (awards/services/lifecycle.py).

A suspended award is appealable while the unresolved installment is withheld
(CGPA breach) or cancelled (missed/invalid renewal). Upholding reinstates the
award — a withheld year becomes approved, a cancelled year reopens to
pending_renewal. Rejecting terminates the award.
"""

from awards.models import (
    AppealStatus,
    AwardAppeal,
    AwardStatus,
    InstallmentStatus,
)
from awards.services.lifecycle import (
    LifecycleError,
    review_appeal,
    submit_appeal,
    submit_renewal,
    verify_installment,
)
from notifications.models import Notification

from .base import AwardTestBase


class AppealTestBase(AwardTestBase):
    def suspended_with_withheld(self):
        """Award suspended by a below-threshold year (the real breach flow)."""
        award = self.make_award()
        inst = self.add_installment(award, year_index=2,
                                    status=InstallmentStatus.PENDING_RENEWAL,
                                    threshold='3.00')
        submit_renewal(award=award, student=award.student, cgpa='2.00',
                       level='300')
        inst.refresh_from_db()
        verify_installment(installment=inst, verifier=self.make_staff('verifier'),
                           action='withhold', note='CGPA below threshold')
        award.refresh_from_db()
        inst.refresh_from_db()
        return award, inst

    def suspended_with_cancelled(self):
        award = self.make_award()
        award.status = AwardStatus.SUSPENDED
        award.suspended_reason = 'No renewal submitted'
        award.save()
        inst = self.add_installment(award, year_index=2,
                                    status=InstallmentStatus.CANCELLED)
        return award, inst


class SubmitAppealTests(AppealTestBase):
    def test_submit_on_withheld_moves_to_pending(self):
        award, inst = self.suspended_with_withheld()
        appeal = submit_appeal(award=award, student=award.student,
                               reason='Medical evidence attached')
        self.assertEqual(appeal.status, AppealStatus.PENDING)
        self.assertEqual(appeal.installment_id, inst.id)
        self.assertTrue(award.events.filter(action='appeal.submitted').exists())
        self.assertTrue(Notification.objects.filter(user=award.student).exists())

    def test_submit_on_cancelled(self):
        award, _inst = self.suspended_with_cancelled()
        appeal = submit_appeal(award=award, student=award.student, reason='late')
        self.assertEqual(appeal.status, AppealStatus.PENDING)

    def test_reason_required(self):
        award, _inst = self.suspended_with_withheld()
        with self.assertRaises(LifecycleError):
            submit_appeal(award=award, student=award.student, reason='   ')

    def test_only_suspended_awards_appealable(self):
        award = self.make_award()  # active
        with self.assertRaises(LifecycleError):
            submit_appeal(award=award, student=award.student, reason='x')

    def test_terminated_award_not_appealable(self):
        award, _inst = self.suspended_with_cancelled()
        award.status = AwardStatus.TERMINATED
        award.save()
        with self.assertRaises(LifecycleError):
            submit_appeal(award=award, student=award.student, reason='x')

    def test_other_student_cannot_appeal(self):
        award, _inst = self.suspended_with_withheld()
        with self.assertRaises(LifecycleError):
            submit_appeal(award=award, student=self.make_student(), reason='x')

    def test_second_pending_appeal_rejected(self):
        award, _inst = self.suspended_with_withheld()
        submit_appeal(award=award, student=award.student, reason='first')
        with self.assertRaises(LifecycleError):
            submit_appeal(award=award, student=award.student, reason='second')


class ReviewAppealTests(AppealTestBase):
    def test_uphold_withheld_approves_installment_and_reactivates(self):
        award, inst = self.suspended_with_withheld()
        appeal = submit_appeal(award=award, student=award.student, reason='mitigating')
        review_appeal(appeal=appeal, reviewer=self.make_staff('admin'),
                      decision='upheld', note='Evidence accepted')

        inst.refresh_from_db()
        award.refresh_from_db()
        appeal.refresh_from_db()
        self.assertEqual(inst.status, InstallmentStatus.APPROVED)
        self.assertEqual(award.status, AwardStatus.ACTIVE)
        self.assertEqual(award.suspended_reason, '')
        self.assertEqual(appeal.status, AppealStatus.UPHELD)
        self.assertTrue(Notification.objects.filter(user=award.student).exists())

    def test_uphold_cancelled_reopens_for_resubmission(self):
        award, inst = self.suspended_with_cancelled()
        appeal = submit_appeal(award=award, student=award.student, reason='was ill')
        review_appeal(appeal=appeal, reviewer=self.make_staff('admin'),
                      decision='upheld', note='Reopened')

        inst.refresh_from_db()
        award.refresh_from_db()
        self.assertEqual(inst.status, InstallmentStatus.PENDING_RENEWAL)
        self.assertEqual(award.status, AwardStatus.ACTIVE)

    def test_reject_terminates_award(self):
        award, _inst = self.suspended_with_withheld()
        appeal = submit_appeal(award=award, student=award.student, reason='x')
        review_appeal(appeal=appeal, reviewer=self.make_staff('admin'),
                      decision='rejected', note='No evidence')

        award.refresh_from_db()
        appeal.refresh_from_db()
        self.assertEqual(appeal.status, AppealStatus.REJECTED)
        self.assertEqual(award.status, AwardStatus.TERMINATED)

    def test_review_requires_note(self):
        award, _inst = self.suspended_with_withheld()
        appeal = submit_appeal(award=award, student=award.student, reason='x')
        with self.assertRaises(LifecycleError):
            review_appeal(appeal=appeal, reviewer=self.make_staff('admin'),
                          decision='upheld', note='')

    def test_cannot_review_twice(self):
        award, _inst = self.suspended_with_withheld()
        appeal = submit_appeal(award=award, student=award.student, reason='x')
        review_appeal(appeal=appeal, reviewer=self.make_staff('admin'),
                      decision='upheld', note='ok')
        with self.assertRaises(LifecycleError):
            review_appeal(appeal=appeal, reviewer=self.make_staff('admin'),
                          decision='rejected', note='again')
