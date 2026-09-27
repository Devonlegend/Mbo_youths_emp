"""Shared fixtures for the awards test package.

Postgres-native (the scheme post_save signal builds a physical application
table via schema_editor, which SQLite refuses inside TestCase). Storage is
overridden per-test where uploads are involved.
"""

import uuid
from types import SimpleNamespace

from django.test import TestCase

from accounts.models import User
from schemes.models import Cycle, SchemeProvider, ScholarshipScheme
from students.models import Student, ProgrammeType
from awards.models import AwardInstallment, InstallmentStatus
from awards.services.creation import create_award


def app_row(current_level='100', course_of_study='Computer Science'):
    return SimpleNamespace(
        id=uuid.uuid4(),
        current_level=current_level,
        course_of_study=course_of_study,
        admission_year=2026,
    )


class AwardTestBase(TestCase):
    counter = 0

    @classmethod
    def setUpTestData(cls):
        cls.provider = SchemeProvider.objects.create(name='Prov', provider_type='lga')
        cls.cycle = Cycle.objects.create(
            name='2026/2027', start_year=2026, end_year=2027, is_active=True)
        cls.next_cycle = Cycle.objects.create(
            name='2027/2028', start_year=2027, end_year=2028)

    @classmethod
    def _next(cls):
        cls.counter += 1
        return cls.counter

    def make_student(self, **profile):
        n = self._next()
        user = User.objects.create_user(
            email=f'student{n}@test.com', firstname='Stu', lastname=f'Dent{n}',
            phone_number=f'0810000{n:04d}', role='student',
            nin_hash=f'nin-hash-student-{n:04d}', password='x', passport='')
        return Student.attach_to_user(user, **profile)

    def make_staff(self, role='verifier'):
        n = self._next()
        return User.objects.create_user(
            email=f'{role}{n}@test.com', firstname='Staff', lastname=f'{role}{n}',
            phone_number=f'0820000{n:04d}', role=role,
            nin_hash=f'nin-hash-staff-{n:04d}', password='x', passport='')

    def make_scheme(self, *, is_recurring=True, min_renewal_cgpa='3.00',
                    amount='150000.00', award_type='scholarship'):
        n = self._next()
        return ScholarshipScheme.objects.create(
            provider=self.provider, cycle=self.cycle,
            name=f'Scheme {n}', award_type=award_type,
            description='x', academic_year='2026/2027', award_amount=amount,
            total_slots=5, remaining_slots=5, is_recurring=is_recurring,
            min_renewal_cgpa=min_renewal_cgpa,
            eligibility_criteria={'min_cgpa': 2.50},
            application_open_date='2026-01-01', application_close_date='2026-12-31',
        )

    def make_award(self, *, student=None, scheme=None, current_level='100',
                   total_years=4):
        student = student or self.make_student(
            programme_type=ProgrammeType.UNDERGRADUATE,
            programme_duration_years=total_years)
        scheme = scheme or self.make_scheme()
        return create_award(student=student, scheme=scheme,
                            application=app_row(current_level), actor=None)

    def add_installment(self, award, *, year_index, status,
                        threshold='3.00', amount='150000.00', cycle=None):
        return AwardInstallment.objects.create(
            award=award, year_index=year_index, cycle=cycle or self.cycle,
            amount=amount, threshold=threshold, status=status)
