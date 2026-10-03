"""Tests for the applications app.

Current coverage: the atomic slot bookkeeping (consume_slot / release_slot)
that backs the 'approval respects the cap' and 'withdraw releases the slot'
changes. The rest of the application flow (eligibility, review state machine,
permissions) is still TODO and should be added here.
"""

from datetime import timedelta
from decimal import Decimal

from django.core.management import call_command
from django.db.models import QuerySet
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase
from django.utils import timezone

from accounts.models import User
from schemes.models import ScholarshipScheme, SchemeProvider, Cycle
from students.models import Student

from applications.dynamic import (
    build_application_table, get_application_model,
    applications_by_status, applications_all, find_application,
)
from applications.models import Application, ApplicationStatus, ApplicationStatusHistory
from awards.models import Award, AwardStatus

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
        cls.student = Student.attach_to_user(cls.user)

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
        cls.student = Student.attach_to_user(cls.user)

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
        cls.student = Student.attach_to_user(student_user,
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
        student = Student.attach_to_user(user, ward=ward, bank_name='UBA',
                                         bank_code='033',
                                         bank_account_number=bank_account,
                                         bank_account_name=lastname)
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


class EndedRecurringAwardExportTests(APITestCase):
    """Edge #24 — an applicant whose recurring award ENDED (terminated or
    graduated) must not export as a current beneficiary."""

    @classmethod
    def setUpTestData(cls):
        cls.provider = SchemeProvider.objects.create(
            name='Edge24 Provider', provider_type='lga')
        cls.cycle = Cycle.objects.create(
            name='2026/2027', start_year=2026, end_year=2027, is_active=True)
        cls.verifier = User.objects.create_user(
            email='verifier@edge24.test', firstname='Veri', lastname='Fier',
            phone_number='08090000024', role='verifier',
            nin_hash='nin-hash-edge24-ver', password='x', passport='')
        student_user = User.objects.create_user(
            email='student@edge24.test', firstname='Ada', lastname='Okon',
            phone_number='08030000024', role='student',
            nin_hash='nin-hash-edge24-stu', password='x', passport='')
        cls.student = Student.attach_to_user(student_user, ward='efiat')
        cls.scheme = ScholarshipScheme.objects.create(
            provider=cls.provider, cycle=cls.cycle, name='Edge24 Recurring',
            description='x', academic_year='2026/2027', award_amount=100000,
            total_slots=5, remaining_slots=5, is_recurring=True,
            application_open_date=timezone.now().date() - timedelta(days=1),
            application_close_date=timezone.now().date() + timedelta(days=30),
        )
        cls.model = build_application_table(cls.scheme)

    def setUp(self):
        self.client.force_authenticate(user=self.verifier)

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

    def _make_award(self, app, status):
        return Award.objects.create(
            student=self.student, scheme=self.scheme, application_id=app.id,
            total_years=4, start_cycle=self.cycle, annual_amount=100000,
            min_cgpa_snapshot=Decimal('3.00'), status=status,
        )

    def test_active_award_applicant_is_listed(self):
        app = self._make_approved()
        self._make_award(app, AwardStatus.ACTIVE)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 1)

    def test_terminated_award_applicant_excluded(self):
        app = self._make_approved()
        self._make_award(app, AwardStatus.TERMINATED)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 0)
        self.assertEqual(resp.data['applications'], [])

    def test_graduated_award_applicant_excluded_from_csv(self):
        app = self._make_approved()
        self._make_award(app, AwardStatus.GRADUATED)
        resp = self.client.get(
            '/applications/approved-list/?scheme={}&export=csv'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn('Ada Okon', resp.content.decode('utf-8'))

    def test_by_scheme_approved_excludes_ended_award(self):
        app = self._make_approved()
        self._make_award(app, AwardStatus.GRADUATED)
        resp = self.client.get(
            '/applications/by-scheme/{}/?status=approved'.format(self.scheme.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['applications'], [])
        self.assertEqual(resp.data['scheme']['total'], 0)


class ApplicationProjectionTests(TestCase):
    """Phase-2 foundation: the unified Application table is dual-written on
    transitions, backfillable, and read-compatible with the legacy UNION."""

    @classmethod
    def setUpTestData(cls):
        cls.provider = SchemeProvider.objects.create(
            name='Projection Provider', provider_type='lga')
        cls.cycle = Cycle.objects.create(
            name='2026/2027', start_year=2026, end_year=2027, is_active=True)
        cls.verifier = User.objects.create_user(
            email='verifier@proj.test', firstname='Veri', lastname='Fier',
            phone_number='08090000031', role='verifier',
            nin_hash='nin-hash-proj-ver', password='x', passport='')
        student_user = User.objects.create_user(
            email='student@proj.test', firstname='Ada', lastname='Okon',
            phone_number='08030000031', role='student',
            nin_hash='nin-hash-proj-stu', password='x', passport='')
        cls.student = Student.attach_to_user(student_user, ward='efiat')
        cls.scheme = ScholarshipScheme.objects.create(
            provider=cls.provider, cycle=cls.cycle, name='Projection Scheme',
            award_type='scholarship', description='x', academic_year='2026/2027',
            award_amount=100000, total_slots=5, remaining_slots=5,
            application_open_date=timezone.now().date() - timedelta(days=1),
            application_close_date=timezone.now().date() + timedelta(days=30),
        )
        cls.model = build_application_table(cls.scheme)

    def _make_app(self, status=ApplicationStatus.SUBMITTED):
        app = self.model.objects.create(
            student=self.student, scheme=self.scheme, status=status,
            submission_date=timezone.now(),
            self_declaration_received_support=False,
            self_declaration_details=[],
            attestation_agreed=True, attestation_at=timezone.now(),
            documents={'last_result': 'https://x/y.pdf'},
            eligibility_passed=True, eligibility_details={},
            waiver_submitted=False,
            bank_name='UBA', bank_code='033', account_number='1010101010',
            account_name='Ada Okon', name_match_passed=True,
            institution_name='University of Uyo', course_of_study='Computer Science',
            current_level='300', cgpa=Decimal('3.50'),
            admission_year=2023, matric_number='U2023/0001',
        )
        ApplicationStatusHistory.objects.create(
            application_id=app.id, scheme=self.scheme, from_status='',
            to_status=status, changed_by=self.verifier, reason='created')
        return app

    def test_history_write_projects_full_row(self):
        app = self._make_app()
        projected = Application.objects.get(id=app.id)
        self.assertEqual(projected.status, ApplicationStatus.SUBMITTED)
        self.assertEqual(projected.student_id, self.student.pk)
        self.assertEqual(projected.scheme_id, self.scheme.id)
        # Full fidelity — detail columns are copied, not just summary fields.
        self.assertEqual(projected.cgpa, Decimal('3.50'))
        self.assertEqual(projected.course_of_study, 'Computer Science')
        self.assertEqual(projected.documents, {'last_result': 'https://x/y.pdf'})

    def test_status_transition_updates_projection(self):
        app = self._make_app()
        app.status = ApplicationStatus.APPROVED
        app.reviewed_by = self.verifier
        app.reviewer_notes = 'ok'
        app.save()
        ApplicationStatusHistory.objects.create(
            application_id=app.id, scheme=self.scheme,
            from_status=ApplicationStatus.SUBMITTED,
            to_status=ApplicationStatus.APPROVED,
            changed_by=self.verifier, reason='ok')
        projected = Application.objects.get(id=app.id)
        self.assertEqual(projected.status, ApplicationStatus.APPROVED)
        self.assertEqual(projected.reviewed_by_id, self.verifier.pk)
        self.assertEqual(projected.reviewer_notes, 'ok')

    def test_waiver_flag_projected(self):
        app = self._make_app(ApplicationStatus.DOUBLE_DIP_FLAG)
        app.waiver_submitted = True
        app.status = ApplicationStatus.DOCUMENT_REVIEW
        app.save()
        ApplicationStatusHistory.objects.create(
            application_id=app.id, scheme=self.scheme,
            from_status=ApplicationStatus.DOUBLE_DIP_FLAG,
            to_status=ApplicationStatus.DOCUMENT_REVIEW,
            changed_by=self.verifier, reason='waiver')
        projected = Application.objects.get(id=app.id)
        self.assertTrue(projected.waiver_submitted)
        self.assertEqual(projected.status, ApplicationStatus.DOCUMENT_REVIEW)

    def test_backfill_rebuilds_projection(self):
        import io
        app = self._make_app()
        Application.objects.all().delete()
        call_command('rebuild_application_projection', stdout=io.StringIO())
        projected = Application.objects.get(id=app.id)
        self.assertEqual(projected.status, ApplicationStatus.SUBMITTED)
        self.assertEqual(projected.matric_number, 'U2023/0001')

    def test_parity_legacy_union_vs_projection(self):
        first = self._make_app(ApplicationStatus.SUBMITTED)
        second = self._make_app(ApplicationStatus.DOUBLE_DIP_FLAG)
        statuses = [ApplicationStatus.SUBMITTED, ApplicationStatus.DOUBLE_DIP_FLAG]

        legacy = {str(r.id) for r in applications_by_status(statuses)}
        with override_settings(APPLICATIONS_USE_PROJECTION=True):
            projected = {str(r.id) for r in applications_by_status(statuses)}
            all_ids = {str(r.id) for r in applications_all()}

        self.assertEqual(legacy, projected)
        self.assertEqual(all_ids, {str(first.id), str(second.id)})

    @override_settings(APPLICATIONS_USE_PROJECTION=True)
    def test_projection_reads_return_queryset(self):
        self._make_app()
        rows = applications_by_status([ApplicationStatus.SUBMITTED])
        self.assertIsInstance(rows, QuerySet)

    @override_settings(APPLICATIONS_USE_PROJECTION=True)
    def test_find_application_uses_projection_then_falls_back(self):
        app = self._make_app()
        found = find_application(app.id)
        self.assertIsNotNone(found)
        _scheme, _model, row = found
        self.assertEqual(str(row.id), str(app.id))
        self.assertEqual(row.cgpa, Decimal('3.50'))  # full row, not just summary

        # Missing projection row (e.g. pre-backfill) must still resolve.
        Application.objects.filter(id=app.id).delete()
        self.assertIsNotNone(find_application(app.id))

    def test_approved_list_reads_projection(self):
        app = self._make_app(ApplicationStatus.APPROVED)
        with override_settings(APPLICATIONS_USE_PROJECTION=True):
            from applications.serializers import serialize_application, serialize_application_list
            projected = Application.objects.get(id=app.id)
            # Both serializers must work on a projection row unchanged.
            self.assertEqual(serialize_application_list(projected)['id'], str(app.id))
            self.assertEqual(serialize_application(projected)['details']['cgpa'], Decimal('3.50'))

    @override_settings(APPLICATIONS_USE_PROJECTION=True)
    def test_review_mutation_keeps_projection_in_sync(self):
        from rest_framework.test import APIClient
        app = self._make_app(ApplicationStatus.SUBMITTED)
        client = APIClient()
        client.force_authenticate(user=self.verifier)

        resp = client.post(f'/applications/{app.id}/review/',
                           {'decision': 'shortlisted'}, format='json')

        self.assertEqual(resp.status_code, 200, resp.data)
        # Mutation wrote the source-of-truth row; the signal re-projected it.
        self.assertEqual(Application.objects.get(id=app.id).status,
                         ApplicationStatus.SHORTLISTED)


class WriteUnifiedTests(TestCase):
    """Phase-2 write cutover (`APPLICATIONS_WRITE_UNIFIED`): the unified table
    is the source of truth and the per-scheme table is mirrored from it."""

    @classmethod
    def setUpTestData(cls):
        cls.provider = SchemeProvider.objects.create(
            name='WriteUnified Provider', provider_type='lga')
        cls.cycle = Cycle.objects.create(
            name='2027/2028', start_year=2027, end_year=2028, is_active=True)
        cls.verifier = User.objects.create_user(
            email='verifier@wu.test', firstname='Veri', lastname='Fier',
            phone_number='08090000041', role='verifier',
            nin_hash='nin-hash-wu-ver', password='x', passport='')
        student_user = User.objects.create_user(
            email='student@wu.test', firstname='Ada', lastname='Okon',
            phone_number='08030000041', role='student',
            nin_hash='nin-hash-wu-stu', password='x', passport='')
        cls.student = Student.attach_to_user(student_user, ward='efiat')
        cls.scheme = ScholarshipScheme.objects.create(
            provider=cls.provider, cycle=cls.cycle, name='WriteUnified Scheme',
            award_type='scholarship', description='x', academic_year='2027/2028',
            award_amount=100000, total_slots=5, remaining_slots=5,
            application_open_date=timezone.now().date() - timedelta(days=1),
            application_close_date=timezone.now().date() + timedelta(days=30),
        )
        cls.model = build_application_table(cls.scheme)

    def _create(self):
        from applications.services.creation import create_application
        return create_application(
            scheme=self.scheme, student=self.student,
            answers={
                'institution_name': 'University of Uyo',
                'course_of_study': 'Computer Science',
                'current_level': '300', 'cgpa': Decimal('3.50'),
                'admission_year': 2023, 'matric_number': 'U2023/0001',
            },
            bank={'bank_name': 'UBA', 'bank_code': '033',
                  'account_number': '1010101010', 'account_name': 'Ada Okon',
                  'name_match_passed': True},
            self_declaration_received_support=False,
            self_declaration_details=[], attestation_agreed=True,
            documents={}, changed_by=self.verifier,
        )

    @override_settings(APPLICATIONS_WRITE_UNIFIED=True)
    def test_create_writes_unified_and_mirrors_legacy(self):
        import io
        app, _result = self._create()

        unified = Application.objects.get(id=app.id)
        self.assertEqual(unified.status, ApplicationStatus.SUBMITTED)
        self.assertEqual(unified.cgpa, Decimal('3.50'))

        # Legacy table mirrored from the unified source (not the reverse).
        legacy = self.model.objects.get(id=app.id)
        self.assertEqual(legacy.status, ApplicationStatus.SUBMITTED)
        self.assertEqual(legacy.cgpa, Decimal('3.50'))

    @override_settings(APPLICATIONS_WRITE_UNIFIED=True)
    def test_find_application_returns_unified_row(self):
        app, _result = self._create()
        _scheme, model, row = find_application(app.id)
        self.assertIs(model, Application)
        self.assertEqual(row.id, app.id)

    @override_settings(APPLICATIONS_WRITE_UNIFIED=True)
    def test_mutation_updates_unified_and_remirrors_legacy(self):
        app, _result = self._create()
        _scheme, _model, row = find_application(app.id)
        row.status = ApplicationStatus.DOCUMENT_REVIEW
        row.waiver_submitted = True
        row.save()
        ApplicationStatusHistory.objects.create(
            application_id=app.id, scheme=self.scheme,
            from_status=ApplicationStatus.SUBMITTED,
            to_status=ApplicationStatus.DOCUMENT_REVIEW,
            changed_by=self.verifier, reason='waiver')

        self.assertEqual(Application.objects.get(id=app.id).status,
                         ApplicationStatus.DOCUMENT_REVIEW)
        legacy = self.model.objects.get(id=app.id)
        self.assertEqual(legacy.status, ApplicationStatus.DOCUMENT_REVIEW)
        self.assertTrue(legacy.waiver_submitted)

    @override_settings(APPLICATIONS_WRITE_UNIFIED=True)
    def test_sync_legacy_from_projection_command(self):
        import io
        app, _result = self._create()
        self.model.objects.all().delete()
        call_command('sync_legacy_from_projection', stdout=io.StringIO())
        legacy = self.model.objects.get(id=app.id)
        self.assertEqual(legacy.status, ApplicationStatus.SUBMITTED)
        self.assertEqual(legacy.matric_number, 'U2023/0001')




