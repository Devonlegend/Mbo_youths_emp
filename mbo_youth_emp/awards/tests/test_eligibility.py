"""Eligibility integration — applications/services/eligibility.py.

Recurring scholarships add a programme-type application gate and make Awards
participate in double-dip detection across every cycle they span (a live award
is a multi-year commitment), plus a same-scheme-any-policy rule. Suspended
awards raise a soft flag, not a hard conflict.
"""

from applications.services.eligibility import EligibilityEngine
from awards.models import AwardStatus
from students.models import ProgrammeType

from .base import AwardTestBase


class ProgrammeTypeGateTests(AwardTestBase):
    def _result(self, scheme, programme_type=None, details=None):
        student = self.make_student(programme_type=programme_type) \
            if programme_type else self.make_student()
        return EligibilityEngine._check_programme_type(student, scheme, details or {})

    def test_undergraduate_allowed_by_default(self):
        scheme = self.make_scheme(applicable_programme_types=[])
        r = self._result(scheme, ProgrammeType.UNDERGRADUATE)
        self.assertTrue(r.passed)

    def test_hnd_rejected_when_only_undergrad_applicable(self):
        scheme = self.make_scheme(applicable_programme_types=['undergraduate'])
        r = self._result(scheme, ProgrammeType.HND)
        self.assertFalse(r.passed)

    def test_explicit_programme_type_in_list_passes(self):
        scheme = self.make_scheme(applicable_programme_types=['undergraduate', 'hnd'])
        r = self._result(scheme, ProgrammeType.HND)
        self.assertTrue(r.passed)

    def test_numeric_level_infers_undergraduate(self):
        scheme = self.make_scheme(applicable_programme_types=['undergraduate'])
        r = self._result(scheme, programme_type=None, details={'current_level': '300'})
        self.assertTrue(r.passed)
        self.assertTrue(r.detail['inferred'])

    def test_missing_data_passes_with_note(self):
        scheme = self.make_scheme(applicable_programme_types=['undergraduate'])
        r = self._result(scheme, programme_type=None, details={})
        self.assertTrue(r.passed)
        self.assertIn('verify manually', r.detail['note'])


class RecurringDoubleDipTests(AwardTestBase):
    def _conflict(self, student, scheme):
        return EligibilityEngine._check_double_dip(student, scheme)

    def test_same_scheme_active_award_conflicts_even_when_open(self):
        scheme = self.make_scheme(stacking_policy='open')
        award = self.make_award(scheme=scheme)

        result = self._conflict(award.student, scheme)

        self.assertFalse(result.passed)
        self.assertIn(str(scheme.id), result.detail['conflicting_ids'])

    def test_recurring_award_conflicts_across_academic_years(self):
        scheme_a = self.make_scheme(academic_year='2026/2027')
        award = self.make_award(scheme=scheme_a)
        scheme_b = self.make_scheme(academic_year='2027/2028')

        result = self._conflict(award.student, scheme_b)

        self.assertFalse(result.passed)
        # The conflict is reported against the scheme the student already holds.
        self.assertIn(str(scheme_a.id), result.detail['conflicting_ids'])

    def test_cross_type_award_conflicts(self):
        scholarship = self.make_scheme(award_type='scholarship')
        award = self.make_award(scheme=scholarship)
        grant = self.make_scheme(award_type='grant', academic_year='2027/2028')

        result = self._conflict(award.student, grant)

        self.assertFalse(result.passed)
        self.assertIn(str(scholarship.id), result.detail['conflicting_ids'])

    def test_award_conflict_detail_carries_award_metadata(self):
        scheme = self.make_scheme(stacking_policy='open')
        award = self.make_award(scheme=scheme)

        result = self._conflict(award.student, scheme)

        detail = next(d for d in result.detail['conflict_details']
                      if d.get('award_id') == str(award.id))
        self.assertEqual(detail['award_year'], '1/4')

    def test_suspended_award_is_soft_not_blocking(self):
        scheme = self.make_scheme(stacking_policy='open')
        award = self.make_award(scheme=scheme)
        award.status = AwardStatus.SUSPENDED
        award.save()

        result = self._conflict(award.student, scheme)

        self.assertTrue(result.passed)  # soft flag does not block
        self.assertNotIn(str(scheme.id), result.detail['conflicting_ids'])
        self.assertTrue(any(d.get('soft') for d in result.detail['conflict_details']))

    def test_terminated_award_ignored(self):
        scheme = self.make_scheme(stacking_policy='open')
        award = self.make_award(scheme=scheme)
        award.status = AwardStatus.TERMINATED
        award.save()

        result = self._conflict(award.student, scheme)

        self.assertTrue(result.passed)
        self.assertEqual(result.detail['conflicting_ids'], [])


class DeadFieldFallbackTests(AwardTestBase):
    def test_cgpa_check_uses_submitted_value_only(self):
        student = self.make_student()  # no cgpa attribute on Student anymore
        scheme = self.make_scheme()
        result, _ = EligibilityEngine._check_cgpa(student, scheme, {'cgpa': '3.00'})
        self.assertTrue(result.passed)

    def test_level_check_uses_submitted_value_only(self):
        student = self.make_student()
        scheme = self.make_scheme()
        scheme.eligibility_criteria = {'allowed_levels': ['200', '300']}
        scheme.save()
        result = EligibilityEngine._check_level(student, scheme,
                                                {'current_level': '200'})
        self.assertTrue(result.passed)
