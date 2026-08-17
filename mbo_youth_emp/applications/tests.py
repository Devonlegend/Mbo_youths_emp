"""Tests for the applications app.

Current coverage: the atomic slot bookkeeping (consume_slot / release_slot)
that backs the 'approval respects the cap' and 'withdraw releases the slot'
changes. The rest of the application flow (eligibility, review state machine,
permissions) is still TODO and should be added here.
"""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APITestCase
from django.utils import timezone

from accounts.models import User
from schemes.models import ScholarshipScheme, SchemeProvider
from students.models import Student

from applications.dynamic import build_application_table, get_application_model
from applications.models import ApplicationStatus, ApplicationStatusHistory

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


class ApprovedListExportTests(APITestCase):
    """GET /applications/approved-list/?scheme={id}

    Flat disbursement list of every approved application in ONE scheme with the
    student's name, phone, email, ward and the application's bank snapshot.
    Also downloads the same data as CSV via `&export=csv`.
    """

    @classmethod
    def setUpTestData(cls):
        cls.provider = SchemeProvider.objects.create(name='Export Provider', provider_type='lga')
        cls.verifier = User.objects.create_user(
            email='verifier@export.test', firstname='Veri', lastname='Fier',
            phone_number='08090000002', role='verifier',
            nin_hash='nin-hash-export-ver', password='x', passport='')
        student_user = User.objects.create_user(
            email='student@export.test', firstname='Ada', lastname='Okon',
            phone_number='08030000002', role='student',
            nin_hash='nin-hash-export-stu', password='x', passport='')
        cls.student = Student.objects.create(
            user=student_user, email=student_user.email,
            firstname='Ada', lastname='Okon', phone_number='08030000002',
            ward='efiat', bank_name='UBA', bank_code='033',
            bank_account_number='1010101010', bank_account_name='Ada Okon')
        cls.scheme = ScholarshipScheme.objects.create(
            provider=cls.provider, name='Export Scheme 2026/2027',
            description='x', academic_year='2026/2027', award_amount=100000,
            total_slots=5, remaining_slots=5,
            application_open_date=timezone.now().date() - timedelta(days=1),
            application_close_date=timezone.now().date() + timedelta(days=30),
        )
        cls.model = build_application_table(cls.scheme)

    def _make_approved(self):
        app = self.model.objects.create(
            student=self.student, scheme=self.scheme,
            status=ApplicationStatus.APPROVED,
            submission_date=timezone.now(),
            self_declaration_received_support=False,
            self_declaration_details=[],
            attestation_agreed=True,
            attestation_at=timezone.now(),
            documents={},
            eligibility_passed=True,
            eligibility_details={},
            waiver_submitted=False,
            bank_name='UBA', bank_code='033',
            account_number='1010101010', account_name='Ada Okon',
            name_match_passed=True,
            institution_name='University of Uyo', course_of_study='Computer Science',
            current_level='300', cgpa=Decimal('3.50'),
            admission_year=2023, matric_number='U2023/0001',
        )
        ApplicationStatusHistory.objects.create(
            application_id=app.id, scheme=self.scheme,
            from_status=ApplicationStatus.SUBMITTED,
            to_status=ApplicationStatus.APPROVED,
            changed_by=self.verifier, reason='meets criteria',
        )
        return app

    def test_scheme_param_is_required(self):
        self.client.force_authenticate(user=self.verifier)
        resp = self.client.get('/applications/approved-list/')
        self.assertEqual(resp.status_code, 400)

    def test_empty_scheme_returns_empty_list(self):
        self.client.force_authenticate(user=self.verifier)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 0)
        self.assertEqual(resp.data['scheme']['name'], self.scheme.name)

    def test_returns_only_approved_with_contact_and_bank(self):
        self._make_approved()
        # A submitted (not yet approved) application must be excluded.
        self.model.objects.create(
            student=self.student, scheme=self.scheme,
            status=ApplicationStatus.SUBMITTED,
            self_declaration_received_support=False,
            bank_name='UBA', bank_code='033',
            account_number='2020202020', account_name='Ada Okon',
            institution_name='Uniuyo', course_of_study='CS',
            current_level='300', cgpa=Decimal('3.00'),
            admission_year=2022, matric_number='U2022/0002',
        )
        self.client.force_authenticate(user=self.verifier)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 1)

        rec = resp.data['applications'][0]
        self.assertEqual(rec['full_name'], 'Ada Okon')
        self.assertEqual(rec['phone_number'], '08030000002')
        self.assertEqual(rec['email'], 'student@export.test')
        self.assertEqual(rec['ward'], 'efiat')
        self.assertEqual(rec['bank_name'], 'UBA')
        self.assertEqual(rec['account_number'], '1010101010')
        self.assertEqual(rec['account_name'], 'Ada Okon')
        self.assertIsNotNone(rec['approved_at'])
        self.assertEqual(rec['scheme']['id'], str(self.scheme.id))

    def test_csv_download(self):
        self._make_approved()
        self.client.force_authenticate(user=self.verifier)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}&export=csv'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn('attachment', resp['Content-Disposition'])
        body = resp.content.decode('utf-8')
        self.assertIn('Full Name,Phone Number,Email', body)
        self.assertIn('Ada Okon', body)
        self.assertIn('08030000002', body)
        self.assertIn('1010101010', body)

    def _make_approved_in_ward(self, ward, email, phone, firstname, lastname,
                               bank_account='3030303030'):
        user = User.objects.create_user(
            email=email, firstname=firstname, lastname=lastname,
            phone_number=phone, role='student',
            nin_hash='nin-hash-export-' + firstname.lower(), password='x',
            passport='')
        student = Student.objects.create(
            user=user, email=email, firstname=firstname, lastname=lastname,
            phone_number=phone, ward=ward, bank_name='UBA', bank_code='033',
            bank_account_number=bank_account, bank_account_name=lastname)
        app = self.model.objects.create(
            student=student, scheme=self.scheme,
            status=ApplicationStatus.APPROVED,
            submission_date=timezone.now(),
            self_declaration_received_support=False,
            self_declaration_details=[],
            attestation_agreed=True,
            attestation_at=timezone.now(),
            documents={},
            eligibility_passed=True,
            eligibility_details={},
            waiver_submitted=False,
            bank_name='UBA', bank_code='033',
            account_number=bank_account, account_name=lastname,
            name_match_passed=True,
            institution_name='University of Uyo', course_of_study='Computer Science',
            current_level='300', cgpa=Decimal('3.50'),
            admission_year=2023, matric_number='U2023/00' + firstname[0],
        )
        ApplicationStatusHistory.objects.create(
            application_id=app.id, scheme=self.scheme,
            from_status=ApplicationStatus.SUBMITTED,
            to_status=ApplicationStatus.APPROVED,
            changed_by=self.verifier, reason='meets criteria',
        )
        return app

    def test_ward_filter_returns_only_that_ward(self):
        self._make_approved()  # ward='efiat'
        self._make_approved_in_ward(
            'okobo', 'student2@export.test', '08030000004',
            'Bassey', 'Edet')
        self.client.force_authenticate(user=self.verifier)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}&ward=okobo'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 1)
        rec = resp.data['applications'][0]
        self.assertEqual(rec['full_name'], 'Bassey Edet')
        self.assertEqual(rec['ward'], 'okobo')

    def test_ward_filter_is_case_insensitive(self):
        self._make_approved()  # ward='efiat'
        self._make_approved_in_ward(
            'OKOBO', 'student3@export.test', '08030000005',
            'Imoh', 'Akpan')
        self.client.force_authenticate(user=self.verifier)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}&ward=okobo'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 1)
        self.assertEqual(resp.data['applications'][0]['ward'], 'OKOBO')

    def test_csv_download_filtered_by_ward(self):
        self._make_approved()  # ward='efiat'
        self._make_approved_in_ward(
            'okobo', 'student4@export.test', '08030000006',
            'Nse', 'Ekanem')
        self.client.force_authenticate(user=self.verifier)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}&ward=okobo&export=csv'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        body = resp.content.decode('utf-8')
        self.assertIn('Nse Ekanem', body)
        self.assertIn('08030000006', body)
        self.assertNotIn('Ada Okon', body)
        self.assertNotIn('08030000002', body)

    def _make_admin(self):
        admin_user = User.objects.create_superuser(
            email='admin@export.test', firstname='Ad', lastname='Min',
            nin_hash='01010101010', phone_number='08040000000', password='x')
        self.client.force_login(admin_user)
        return admin_user

    def test_admin_action_redirects_to_ward_picker(self):
        self._make_approved()
        self._make_admin()
        from schemes.admin import export_approved_list
        from schemes.models import ScholarshipScheme

        class _Stub:
            def message_user(self, request, message, level=None):
                self.last_message = message

        stub = _Stub()
        qs = ScholarshipScheme.objects.filter(id=self.scheme.id)
        resp = export_approved_list(stub, self.client.get('/admin/').wsgi_request, qs)
        self.assertEqual(resp.status_code, 302)
        self.assertIn('export-approved-list/?ids={}'.format(self.scheme.id), resp['Location'])

    def test_admin_ward_picker_page_lists_wards(self):
        self._make_approved()  # ward='efiat'
        self._make_approved_in_ward(
            'okobo', 'student5@export.test', '08030000007',
            'Uduak', 'Offiong')
        self._make_admin()
        resp = self.client.get(
            '/admin/schemes/scholarshipscheme/export-approved-list/?ids={}'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertIn(self.scheme.name, resp.content.decode('utf-8'))
        self.assertContains(resp, 'efiat')
        self.assertContains(resp, 'okobo')

    def test_admin_ward_export_streams_only_that_ward(self):
        self._make_approved()  # ward='efiat'
        self._make_approved_in_ward(
            'okobo', 'student6@export.test', '08030000008',
            'Aniekan', 'Udo')
        self._make_admin()
        resp = self.client.post(
            '/admin/schemes/scholarshipscheme/export-approved-list/?ids={}'.format(self.scheme.id),
            {'ward': 'okobo'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn('attachment', resp['Content-Disposition'])
        self.assertIn('okobo', resp['Content-Disposition'])
        body = resp.content.decode('utf-8')
        self.assertIn('Aniekan Udo', body)
        self.assertNotIn('Ada Okon', body)

    def test_admin_ward_export_all_wards(self):
        self._make_approved()  # ward='efiat'
        self._make_approved_in_ward(
            'okobo', 'student7@export.test', '08030000009',
            'Mfon', 'Jacob')
        self._make_admin()
        resp = self.client.post(
            '/admin/schemes/scholarshipscheme/export-approved-list/?ids={}'.format(self.scheme.id),
            {'ward': ''})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['Content-Type'], 'text/csv; charset=utf-8')
        body = resp.content.decode('utf-8')
        self.assertIn('Ada Okon', body)
        self.assertIn('Mfon Jacob', body)

    def test_students_are_not_allowed(self):

        plain_user = User.objects.create_user(
            email='plain@export.test', firstname='P', lastname='S',
            phone_number='08030000003', role='student',
            nin_hash='nin-hash-export-plain', password='x', passport='')
        self.client.force_authenticate(user=plain_user)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 403)
