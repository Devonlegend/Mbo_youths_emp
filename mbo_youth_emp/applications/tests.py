"""Tests for the applications app.

Current coverage: the atomic slot bookkeeping (consume_slot / release_slot)
that backs the 'approval respects the cap' and 'withdraw releases the slot'
changes. The rest of the application flow (eligibility, review state machine,
permissions) is still TODO and should be added here.
"""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from schemes.models import ScholarshipScheme, SchemeProvider
from students.models import Student

from applications.dynamic import get_application_model
from applications.models import ApplicationStatus

from .services.slots import consume_slot, release_slot
from .services.withdrawal import withdraw_application


class SlotBookkeepingTests(TestCase):
    """consume_slot / release_slot behave atomically and never oversubscribe."""

    @classmethod
    def setUpTestData(cls):
        cls.provider = SchemeProvider.objects.create(name='SlotTest', provider_type='lga')
        cls.user = User.objects.create_user(
            email='slot@test.com',
            firstname='A',
            lastname='B',
            phone_number='08000000000',
            role='student',
            nin_hash='nin-hash-slot-test-0001',
            password='x',
            passport='',
        )
        cls.student = Student.objects.create(
            user=cls.user, email=cls.user.email, firstname='A', lastname='B')

    def _make_scheme(self, slots=1):
        return ScholarshipScheme.objects.create(
            provider=self.provider,
            name=f'Scheme {slots}',
            description='x',
            academic_year='2026/2027',
            award_amount=50000,
            total_slots=slots,
            remaining_slots=slots,
            application_open_date=timezone.now().date() - timedelta(days=1),
            application_close_date=timezone.now().date() + timedelta(days=30),
        )

    def test_consume_never_goes_below_zero(self):
        scheme = self._make_scheme(1)
        self.assertTrue(consume_slot(scheme))
        self.assertEqual(scheme.remaining_slots, 0)
        # Second consume must fail and leave the count untouched.
        self.assertFalse(consume_slot(scheme))
        self.assertEqual(scheme.remaining_slots, 0)

    def test_release_returns_the_slot(self):
        scheme = self._make_scheme(1)
        consume_slot(scheme)
        self.assertEqual(scheme.remaining_slots, 0)
        release_slot(scheme)
        scheme.refresh_from_db(fields=['remaining_slots'])
        self.assertEqual(scheme.remaining_slots, 1)

    def test_release_clears_matching_active_award(self):
        scheme = self._make_scheme(1)
        consume_slot(scheme)
        self.student.active_award = scheme.name
        self.student.save(update_fields=['active_award'])
        release_slot(scheme, self.student)
        self.student.refresh_from_db(fields=['active_award'])
        self.assertEqual(self.student.active_award, '')

    def test_release_keeps_unrelated_active_award(self):
        scheme = self._make_scheme(1)
        consume_slot(scheme)
        self.student.active_award = 'Some Other Award'
        self.student.save(update_fields=['active_award'])
        release_slot(scheme, self.student)
        self.student.refresh_from_db(fields=['active_award'])
        self.assertEqual(self.student.active_award, 'Some Other Award')


class WithdrawApplicationTests(TestCase):
    """withdraw_application marks the app withdrawn and releases its slot."""

    @classmethod
    def setUpTestData(cls):
        cls.provider = SchemeProvider.objects.create(name='SlotTest', provider_type='lga')
        cls.user = User.objects.create_user(
            email='withdraw@test.com', firstname='A', lastname='B',
            phone_number='08000000001', role='student',
            nin_hash='nin-hash-withdraw-001', password='x', passport='')
        cls.student = Student.objects.create(
            user=cls.user, email=cls.user.email, firstname='A', lastname='B')

    def _make_approved_app(self, slots=1):
        scheme = ScholarshipScheme.objects.create(
            provider=self.provider, name='Withdraw Scheme', description='x',
            academic_year='2026/2027', award_amount=50000,
            total_slots=slots, remaining_slots=slots,
            application_open_date=timezone.now().date() - timedelta(days=1),
            application_close_date=timezone.now().date() + timedelta(days=30),
        )
        model = get_application_model(scheme)
        app = model.objects.create(
            student=self.student, scheme=scheme,
            status=ApplicationStatus.APPROVED,
            submission_date=timezone.now(), attestation_agreed=True,
            eligibility_passed=True,
            institution_name='X University', course_of_study='CS',
            current_level='300', cgpa=Decimal('3.50'),
            admission_year=2025, matric_number='MAT/001',
        )
        return scheme, app

    def test_withdraw_marks_withdrawn_and_releases_slot(self):
        scheme, app = self._make_approved_app(slots=1)
        consume_slot(scheme)  # take the single slot, so remaining is 0
        self.assertEqual(scheme.remaining_slots, 0)

        self.student.active_award = scheme.name
        self.student.save(update_fields=['active_award'])

        withdrawn_app, remaining = withdraw_application(app, scheme, self.user)

        self.assertEqual(withdrawn_app.status, ApplicationStatus.WITHDRAWN)
        self.assertEqual(remaining, 1)
        scheme.refresh_from_db(fields=['remaining_slots'])
        self.assertEqual(scheme.remaining_slots, 1)
        self.student.refresh_from_db(fields=['active_award'])
        self.assertEqual(self.student.active_award, '')


