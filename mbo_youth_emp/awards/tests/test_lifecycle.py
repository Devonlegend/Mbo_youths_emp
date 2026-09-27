"""Lifecycle transitions — awards/services/lifecycle.py.

Every transition is source-status guarded (idempotent vs double-click /
double-pay) and every mutation leaves an AwardEvent. The money-critical rules:
the CGPA gate compares the normalized value; disbursement is the only path
that advances current_year_index and the only path that graduates.
"""

from decimal import Decimal

from django.test import TestCase

from awards.models import AwardStatus, InstallmentStatus
from awards.services.lifecycle import (
    LifecycleError, disburse_installment, normalize_cgpa, submit_renewal,
    suspend_award, terminate_award, verify_installment,
)
from notifications.models import Notification

from .base import AwardTestBase


class NormalizeCgpaTests(TestCase):
    def test_five_scale_is_identity(self):
        self.assertEqual(normalize_cgpa('3.50', '5.0'), Decimal('3.50'))

    def test_four_scale_scales_up(self):
        self.assertEqual(normalize_cgpa('3.20', '4.0'), Decimal('4.00'))

    def test_rounds_to_two_dp(self):
        self.assertEqual(normalize_cgpa('3.33', '4.0'), Decimal('4.16'))

    def test_bad_scale_rejected(self):
        with self.assertRaises(LifecycleError):
            normalize_cgpa('3.0', '0')
        with self.assertRaises(LifecycleError):
            normalize_cgpa('3.0', 'abc')


class SubmitRenewalTests(AwardTestBase):
    def _open_award(self, **kw):
        award = self.make_award(**kw)
        self.add_installment(award, year_index=2,
                             status=InstallmentStatus.PENDING_RENEWAL)
        return award

    def test_moves_to_pending_verification(self):
        award = self._open_award()
        student = award.student
        inst = submit_renewal(award=award, student=student, cgpa='3.75',
                              level='300', cgpa_scale='5.0')

        self.assertEqual(inst.status, InstallmentStatus.PENDING_VERIFICATION)
        self.assertEqual(inst.submitted_cgpa, Decimal('3.75'))
        self.assertEqual(inst.submitted_cgpa_normalized, Decimal('3.75'))
        self.assertEqual(inst.submitted_level, '300')
        self.assertTrue(award.events.filter(action='renewal.submitted').exists())
        self.assertTrue(Notification.objects.filter(user=student).exists())

    def test_four_scale_is_normalized(self):
        award = self._open_award()
        inst = submit_renewal(award=award, student=award.student, cgpa='3.20',
                              level='300', cgpa_scale='4.0')
        self.assertEqual(inst.submitted_cgpa, Decimal('3.20'))
        self.assertEqual(inst.submitted_cgpa_normalized, Decimal('4.00'))

    def test_rejected_when_award_not_active(self):
        award = self._open_award()
        award.status = AwardStatus.SUSPENDED
        award.save()
        with self.assertRaises(LifecycleError):
            submit_renewal(award=award, student=award.student, cgpa='3.5',
                           level='300')

    def test_rejected_when_no_open_installment(self):
        award = self.make_award()  # year 1 is approved, not pending_renewal
        with self.assertRaises(LifecycleError):
            submit_renewal(award=award, student=award.student, cgpa='3.5',
                           level='200')

    def test_rejected_for_another_students_award(self):
        award = self._open_award()
        other = self.make_student()
        with self.assertRaises(LifecycleError):
            submit_renewal(award=award, student=other, cgpa='3.5', level='300')

    def test_bad_scale_value_rejected(self):
        award = self._open_award()
        with self.assertRaises(LifecycleError):
            submit_renewal(award=award, student=award.student, cgpa='3.5',
                           level='300', cgpa_scale='7.0')


class VerifyInstallmentTests(AwardTestBase):
    def _submitted(self, threshold='3.00'):
        award = self.make_award()
        student = award.student
        inst = self.add_installment(award, year_index=2,
                                    status=InstallmentStatus.PENDING_RENEWAL,
                                    threshold=threshold)
        submit_renewal(award=award, student=student, cgpa='3.50', level='300')
        inst.refresh_from_db()  # submit_renewal loads its own instance
        return award, inst, self.make_staff()

    def test_approve_above_threshold(self):
        award, inst, verifier = self._submitted()
        verify_installment(installment=inst, verifier=verifier, action='approve')
        inst.refresh_from_db()
        self.assertEqual(inst.status, InstallmentStatus.APPROVED)
        self.assertEqual(inst.verified_by, verifier)

    def test_approve_below_threshold_refused(self):
        award, inst, verifier = self._submitted(threshold='4.00')
        with self.assertRaises(LifecycleError):
            verify_installment(installment=inst, verifier=verifier, action='approve')
        inst.refresh_from_db()
        self.assertEqual(inst.status, InstallmentStatus.PENDING_VERIFICATION)

    def test_approve_zero_threshold_is_no_gate(self):
        award, inst, verifier = self._submitted(threshold='0.00')
        verify_installment(installment=inst, verifier=verifier, action='approve')
        inst.refresh_from_db()
        self.assertEqual(inst.status, InstallmentStatus.APPROVED)

    def test_reject_returns_to_pending_renewal(self):
        award, inst, verifier = self._submitted()
        verify_installment(installment=inst, verifier=verifier, action='reject',
                           note='Blurry transcript')
        inst.refresh_from_db()
        self.assertEqual(inst.status, InstallmentStatus.PENDING_RENEWAL)
        self.assertEqual(inst.resubmission_count, 1)

    def test_reject_requires_note(self):
        award, inst, verifier = self._submitted()
        with self.assertRaises(LifecycleError):
            verify_installment(installment=inst, verifier=verifier, action='reject')

    def test_rejection_cap_cancels_and_suspends(self):
        award, inst, verifier = self._submitted()
        # First reject → back to student.
        verify_installment(installment=inst, verifier=verifier, action='reject',
                           note='bad pdf')
        # Student resubmits, verifier rejects again → cap (2) reached.
        submit_renewal(award=award, student=award.student, cgpa='3.5', level='300')
        inst.refresh_from_db()
        verify_installment(installment=inst, verifier=verifier, action='reject',
                           note='still bad')
        inst.refresh_from_db()
        award.refresh_from_db()
        self.assertEqual(inst.status, InstallmentStatus.CANCELLED)
        self.assertEqual(award.status, AwardStatus.SUSPENDED)

    def test_withhold_suspends_award(self):
        award, inst, verifier = self._submitted(threshold='4.00')
        verify_installment(installment=inst, verifier=verifier, action='withhold',
                           note='CGPA below threshold')
        inst.refresh_from_db()
        award.refresh_from_db()
        self.assertEqual(inst.status, InstallmentStatus.WITHHELD)
        self.assertEqual(award.status, AwardStatus.SUSPENDED)
        self.assertTrue(award.suspended_reason)

    def test_cannot_verify_when_not_pending(self):
        award, inst, verifier = self._submitted()
        inst.status = InstallmentStatus.PENDING_RENEWAL
        inst.save()
        with self.assertRaises(LifecycleError):
            verify_installment(installment=inst, verifier=verifier, action='approve')


class DisburseTests(AwardTestBase):
    def test_disburse_advances_index_and_does_not_graduate_midcourse(self):
        award = self.make_award()  # total_years=4, year1 approved
        inst = award.installments.get(year_index=1)
        admin = self.make_staff('admin')
        disburse_installment(installment=inst, admin=admin, disbursement_ref='REF-1')

        inst.refresh_from_db()
        award.refresh_from_db()
        self.assertEqual(inst.status, InstallmentStatus.DISBURSED)
        self.assertEqual(inst.disbursement_ref, 'REF-1')
        self.assertEqual(award.current_year_index, 1)
        self.assertEqual(award.status, AwardStatus.ACTIVE)

    def test_double_disburse_is_rejected(self):
        award = self.make_award()
        inst = award.installments.get(year_index=1)
        admin = self.make_staff('admin')
        disburse_installment(installment=inst, admin=admin)
        with self.assertRaises(LifecycleError):
            disburse_installment(installment=inst, admin=admin)

    def test_disburse_requires_approved(self):
        award = self.make_award()
        inst = self.add_installment(award, year_index=2,
                                    status=InstallmentStatus.PENDING_VERIFICATION)
        with self.assertRaises(LifecycleError):
            disburse_installment(installment=inst, admin=self.make_staff('admin'))

    def test_final_disbursement_graduates_and_clears_label(self):
        award = self.make_award(total_years=1)
        award.student.active_award = award.scheme.name
        award.student.save(update_fields=['active_award'])

        inst = award.installments.get(year_index=1)
        disburse_installment(installment=inst, admin=self.make_staff('admin'))

        award.refresh_from_db()
        award.student.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.GRADUATED)
        self.assertEqual(award.current_year_index, 1)
        self.assertEqual(award.student.active_award, '')
        self.assertTrue(award.events.filter(action='graduated').exists())


class SuspendTerminateTests(AwardTestBase):
    def test_suspend_active_award(self):
        award = self.make_award()
        suspend_award(award=award, actor=self.make_staff('admin'), reason='manual')
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.SUSPENDED)
        self.assertEqual(award.suspended_reason, 'manual')

    def test_cannot_suspend_terminated(self):
        award = self.make_award()
        award.status = AwardStatus.TERMINATED
        award.save()
        with self.assertRaises(LifecycleError):
            suspend_award(award=award, actor=self.make_staff('admin'))

    def test_terminate_cancels_non_disbursed_and_clears_label(self):
        award = self.make_award()
        award.student.active_award = award.scheme.name
        award.student.save(update_fields=['active_award'])
        self.add_installment(award, year_index=2,
                             status=InstallmentStatus.PENDING_RENEWAL)

        terminate_award(award=award, actor=self.make_staff('admin'),
                        reason='policy')
        award.refresh_from_db()
        award.student.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.TERMINATED)
        self.assertEqual(award.student.active_award, '')
        self.assertEqual(
            award.installments.filter(status=InstallmentStatus.CANCELLED).count(), 2)

    def test_cannot_terminate_graduated(self):
        award = self.make_award()
        award.status = AwardStatus.GRADUATED
        award.save()
        with self.assertRaises(LifecycleError):
            terminate_award(award=award, actor=self.make_staff('admin'))
