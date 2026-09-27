"""Award creation on approval — awards/services/creation.py.

The invariants that matter:
  * Idempotent — a retried/double-clicked approval never creates two awards.
  * Year-1 installment is APPROVED (approval = first payment queued).
  * Threshold snapshot: explicit min_renewal_cgpa wins; else falls back to the
    eligibility min_cgpa; scheme edits afterwards never touch existing awards.
  * Withdrawal cascade terminates the award and cancels non-disbursed
    installments only (disbursed money is terminal).
"""

from types import SimpleNamespace

from django.test import TestCase

from accounts.models import User
from schemes.models import Cycle, SchemeProvider, ScholarshipScheme
from students.models import Student, ProgrammeType
from awards.models import (
    Award, AwardInstallment, AwardStatus, InstallmentStatus,
)
from awards.services.creation import (
    create_award, renewal_threshold_for, terminate_award_for_withdrawal,
)


def app_row(current_level='100', course_of_study='Computer Science'):
    return SimpleNamespace(
        id=__import__('uuid').uuid4(),
        current_level=current_level,
        course_of_study=course_of_study,
        admission_year=2026,
    )


class AwardCreationTestCase(TestCase):
    counter = 0

    @classmethod
    def setUpTestData(cls):
        cls.provider = SchemeProvider.objects.create(name='Prov', provider_type='lga')
        cls.cycle = Cycle.objects.create(
            name='2026/2027', start_year=2026, end_year=2027, is_active=True)

    def make_student(self, **profile):
        type(self).counter += 1
        n = type(self).counter
        user = User.objects.create_user(
            email=f'create{n}@test.com', firstname='C', lastname=f'S{n}',
            phone_number=f'08100000{n:03d}', role='student',
            nin_hash=f'nin-hash-create-{n:04d}', password='x', passport='')
        return Student.attach_to_user(user, **profile)

    def make_scheme(self, *, is_recurring=True, min_renewal_cgpa=None,
                    min_cgpa=None, amount='150000.00'):
        type(self).counter += 1
        return ScholarshipScheme.objects.create(
            provider=self.provider, cycle=self.cycle,
            name=f'Scheme {type(self).counter}', award_type='scholarship',
            description='x', academic_year='2026/2027', award_amount=amount,
            total_slots=5, remaining_slots=5,
            is_recurring=is_recurring, min_renewal_cgpa=min_renewal_cgpa,
            eligibility_criteria={'min_cgpa': min_cgpa} if min_cgpa else {},
            application_open_date='2026-01-01', application_close_date='2026-12-31',
        )


class ThresholdTests(TestCase):
    def setUp(self):
        self.provider = SchemeProvider.objects.create(name='P2', provider_type='ngo')
        self.cycle = Cycle.objects.create(name='2027/2028', start_year=2027, end_year=2028)

    def scheme(self, min_renewal, criteria):
        return ScholarshipScheme(
            provider=self.provider, cycle=self.cycle, name='S', award_type='scholarship',
            description='x', academic_year='2026/2027', award_amount='1.00',
            total_slots=1, remaining_slots=1, min_renewal_cgpa=min_renewal,
            eligibility_criteria=criteria,
            application_open_date='2026-01-01', application_close_date='2026-12-31')

    def test_explicit_renewal_threshold_wins(self):
        s = self.scheme('3.50', {'min_cgpa': 2.50})
        self.assertEqual(float(renewal_threshold_for(s)), 3.50)

    def test_falls_back_to_eligibility_min_cgpa(self):
        s = self.scheme(None, {'min_cgpa': 2.50})
        self.assertEqual(float(renewal_threshold_for(s)), 2.50)

    def test_no_threshold_anywhere_is_zero_not_error(self):
        s = self.scheme(None, {})
        self.assertEqual(float(renewal_threshold_for(s)), 0.0)


class CreateAwardTests(AwardCreationTestCase):
    def test_creates_award_with_year1_installment_approved(self):
        student = self.make_student(programme_type=ProgrammeType.UNDERGRADUATE,
                                    programme_duration_years=4)
        scheme = self.make_scheme(min_renewal_cgpa='3.00')
        award = create_award(student=student, scheme=scheme,
                             application=app_row('100'), actor=None)

        self.assertEqual(award.status, AwardStatus.ACTIVE)
        self.assertEqual(award.total_years, 4)
        self.assertEqual(award.current_year_index, 0)  # paid-years counter: nothing disbursed yet
        self.assertEqual(award.start_cycle, self.cycle)
        self.assertEqual(str(award.annual_amount), '150000.00')
        self.assertEqual(str(award.min_cgpa_snapshot), '3.00')
        self.assertEqual(award.tenure_confidence, 'confirmed')

        inst = award.installments.get()
        self.assertEqual(inst.year_index, 1)
        self.assertEqual(inst.status, InstallmentStatus.APPROVED)
        self.assertEqual(str(inst.amount), '150000.00')
        self.assertEqual(str(inst.threshold), '3.00')

        event = award.events.get()
        self.assertEqual(event.action, 'created')

    def test_idempotent_double_call_returns_none(self):
        student = self.make_student(programme_duration_years=4)
        scheme = self.make_scheme()
        row = app_row('100')
        first = create_award(student=student, scheme=scheme, application=row, actor=None)
        second = create_award(student=student, scheme=scheme, application=row, actor=None)
        self.assertIsNotNone(first)
        self.assertIsNone(second)
        self.assertEqual(Award.objects.filter(application_id=row.id).count(), 1)
        self.assertEqual(AwardInstallment.objects.count(), 1)

    def test_threshold_snapshot_survives_scheme_edit(self):
        student = self.make_student(programme_duration_years=4)
        scheme = self.make_scheme(min_renewal_cgpa='3.00')
        award = create_award(student=student, scheme=scheme,
                             application=app_row('100'), actor=None)
        scheme.min_renewal_cgpa = 4.50
        scheme.award_amount = 999999
        scheme.save()
        award.refresh_from_db()
        self.assertEqual(str(award.min_cgpa_snapshot), '3.00')
        self.assertEqual(str(award.annual_amount), '150000.00')

    def test_missing_profile_data_degrades_but_still_creates(self):
        student = self.make_student()  # nothing filled in
        scheme = self.make_scheme()
        award = create_award(student=student, scheme=scheme,
                             application=app_row('Postgraduate', 'CS'), actor=None)
        self.assertEqual(award.total_years, 1)
        self.assertEqual(award.tenure_confidence, 'degraded')
        self.assertTrue(award.tenure_flags)  # admin has something to read

    def test_midcourse_student_gets_remaining_years(self):
        student = self.make_student(programme_duration_years=4)
        scheme = self.make_scheme()
        award = create_award(student=student, scheme=scheme,
                             application=app_row('300'), actor=None)
        self.assertEqual(award.total_years, 2)  # 300L + 400L


class WithdrawalCascadeTests(AwardCreationTestCase):
    def test_withdrawal_terminates_and_cancels_non_disbursed(self):
        student = self.make_student(programme_duration_years=4)
        scheme = self.make_scheme()
        award = create_award(student=student, scheme=scheme,
                             application=app_row('100'), actor=None)

        # Simulate year-2 rollover then a disbursement on year 1.
        inst1 = award.installments.get(year_index=1)
        inst1.status = InstallmentStatus.DISBURSED
        inst1.save()
        AwardInstallment.objects.create(
            award=award, year_index=2, cycle=self.cycle,
            amount=award.annual_amount, threshold=award.min_cgpa_snapshot,
            status=InstallmentStatus.PENDING_RENEWAL)

        terminate_award_for_withdrawal(application=app_row(), actor=None)  # wrong id → no-op
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.ACTIVE)  # untouched

        # Real cascade
        inst1.award.refresh_from_db()
        terminate = terminate_award_for_withdrawal(
            application=SimpleNamespace(id=award.application_id), actor=None)
        award.refresh_from_db()
        self.assertEqual(award.status, AwardStatus.TERMINATED)
        self.assertEqual(
            award.installments.get(year_index=1).status, InstallmentStatus.DISBURSED)
        self.assertEqual(
            award.installments.get(year_index=2).status, InstallmentStatus.CANCELLED)
