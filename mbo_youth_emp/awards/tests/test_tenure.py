"""Tenure resolution matrix — awards/services/tenure.py.

The contract that matters most: resolve_total_years must NEVER raise (it runs
inside review()'s atomic block) and must NEVER silently guess — anything not
derived from explicit profile data drops confidence and records a flag.
"""

from types import SimpleNamespace

from django.test import TestCase

from accounts.models import User
from students.models import Student, ProgrammeType
from awards.services.tenure import (
    resolve_total_years, parse_level, TenureConfidence, MAX_TENURE,
)


def row(current_level=None, course_of_study='', admission_year=2026):
    """Duck-typed application row — mirrors the per-scheme table fields the
    resolver reads, without touching dynamic tables."""
    return SimpleNamespace(
        current_level=current_level,
        course_of_study=course_of_study,
        admission_year=admission_year,
    )


class TenureTestCase(TestCase):
    counter = 0

    def make_student(self, **profile):
        type(self).counter += 1
        n = type(self).counter
        user = User.objects.create_user(
            email=f'tenure{n}@test.com',
            firstname='T', lastname=f'S{n}',
            phone_number=f'08000000{n:03d}',
            role='student',
            nin_hash=f'nin-hash-tenure-{n:04d}',
            password='x',
            passport='',
        )
        return Student.attach_to_user(user, **profile)


class ParseLevelTests(TestCase):
    def test_plain_numeric_strings(self):
        self.assertEqual(parse_level('100'), 100)
        self.assertEqual(parse_level('500'), 500)

    def test_suffixed(self):
        self.assertEqual(parse_level('200L'), 200)

    def test_unparseable_returns_none(self):
        self.assertIsNone(parse_level('Postgraduate'))
        self.assertIsNone(parse_level(''))
        self.assertIsNone(parse_level(None))
        self.assertIsNone(parse_level('Year One'))


class UndergradTenureTests(TenureTestCase):
    """Undergraduate: total = duration - (current_level//100 - 1)."""

    def student(self, duration=4, **kw):
        kw.setdefault('programme_type', ProgrammeType.UNDERGRADUATE)
        kw.setdefault('programme_duration_years', duration)
        return self.make_student(**kw)

    def test_4yr_at_100L(self):
        r = resolve_total_years(self.student(4), row('100'))
        self.assertEqual(r.total_years, 4)
        self.assertEqual(r.confidence, TenureConfidence.CONFIRMED)
        self.assertFalse(r.needs_admin_attention)

    def test_5yr_at_100L(self):
        r = resolve_total_years(self.student(5), row('200'))  # entered 100, now 200
        self.assertEqual(r.total_years, 4)

    def test_6yr_medicine_at_100L(self):
        r = resolve_total_years(self.student(6), row('100'))
        self.assertEqual(r.total_years, 6)

    def test_direct_entry_5yr_now_200L(self):
        r = resolve_total_years(self.student(5, entry_level=200), row('200'))
        self.assertEqual(r.total_years, 4)

    def test_6yr_at_200L(self):
        r = resolve_total_years(self.student(6), row('200'))
        self.assertEqual(r.total_years, 5)

    def test_midcourse_4yr_at_300L_pays_remaining_only(self):
        """Bug-3 regression: tenure counts from CURRENT level, not entry."""
        r = resolve_total_years(self.student(4), row('300'))
        self.assertEqual(r.total_years, 2)  # 300L + 400L

    def test_entry_level_field_is_never_used_for_math(self):
        """A DE student (entered 200L) now at 300L in a 5-yr course has 3
        payments left. If tenure used entry_level it would wrongly say 4."""
        r = resolve_total_years(self.student(5, entry_level=200), row('300'))
        self.assertEqual(r.total_years, 3)

    def test_final_year_overshoot_clamps_to_1_with_flag(self):
        r = resolve_total_years(self.student(4), row('500'))  # 4-(5-1)=0
        self.assertEqual(r.total_years, 1)
        self.assertTrue(any('clamped' in f for f in r.flags))

    def test_unparseable_level_degrades_never_raises(self):
        r = resolve_total_years(self.student(4), row('Postgraduate'))
        self.assertEqual(r.total_years, 1)
        self.assertEqual(r.confidence, TenureConfidence.DEGRADED)
        self.assertTrue(r.needs_admin_attention)

    def test_out_of_range_clamps_to_max_with_flag(self):
        # '50' parses to 50 → 50//100-1 = -1 → 6-(-1) = 7 > MAX_TENURE.
        r = resolve_total_years(self.student(6), row('50'))
        self.assertEqual(r.total_years, MAX_TENURE)
        self.assertTrue(any('clamped' in f for f in r.flags))


class DurationInferenceTests(TenureTestCase):
    """No profile duration → keyword hint (INFERRED) or type default (INFERRED
    + flag). Never silently CONFIRMED."""

    def student(self, **kw):
        kw.setdefault('programme_type', ProgrammeType.UNDERGRADUATE)
        return self.make_student(**kw)

    def test_engineering_course_text_infers_5(self):
        r = resolve_total_years(self.student(), row('100', 'Mechanical Engineering'))
        self.assertEqual(r.total_years, 5)
        self.assertEqual(r.confidence, TenureConfidence.INFERRED)
        self.assertTrue(any('inferred' in f for f in r.flags))

    def test_mbbs_infers_6(self):
        r = resolve_total_years(self.student(), row('100', 'MBBS'))
        self.assertEqual(r.total_years, 6)
        self.assertEqual(r.confidence, TenureConfidence.INFERRED)

    def test_unmatched_course_text_defaults_4_with_flag(self):
        """'CS' matches nothing — falls to the 4-yr default, loudly."""
        r = resolve_total_years(self.student(), row('100', 'CS'))
        self.assertEqual(r.total_years, 4)
        self.assertEqual(r.confidence, TenureConfidence.INFERRED)
        self.assertTrue(any('assumed 4yr default' in f for f in r.flags))

    def test_faculty_field_preferred_over_course_text(self):
        r = resolve_total_years(
            self.student(faculty='Faculty of Law'), row('100', 'CS'))
        self.assertEqual(r.total_years, 5)  # law → 5, 'CS' would have given 4

    def test_explicit_profile_duration_beats_lookup(self):
        r = resolve_total_years(
            self.student(programme_duration_years=4), row('100', 'Medicine and Surgery'))
        self.assertEqual(r.total_years, 4)
        self.assertEqual(r.confidence, TenureConfidence.CONFIRMED)


class NonUndergradTenureTests(TenureTestCase):
    """HND / PG: no level math — tenure is full remaining duration from award
    start. Levels don't apply."""

    def test_hnd_default_2_inferred(self):
        s = self.make_student(programme_type=ProgrammeType.HND)
        r = resolve_total_years(s, row(None, 'Accountancy'))
        self.assertEqual(r.total_years, 2)
        self.assertEqual(r.confidence, TenureConfidence.INFERRED)

    def test_hnd_explicit_confirmed(self):
        s = self.make_student(programme_type=ProgrammeType.HND,
                              programme_duration_years=2)
        r = resolve_total_years(s, row(None))
        self.assertEqual(r.total_years, 2)
        self.assertEqual(r.confidence, TenureConfidence.CONFIRMED)

    def test_pg_taught_default_1(self):
        s = self.make_student(programme_type=ProgrammeType.POSTGRAD_TAUGHT)
        r = resolve_total_years(s, row(None))
        self.assertEqual(r.total_years, 1)
        self.assertEqual(r.confidence, TenureConfidence.INFERRED)

    def test_pg_research_default_3(self):
        s = self.make_student(programme_type=ProgrammeType.POSTGRAD_RESEARCH)
        r = resolve_total_years(s, row(None))
        self.assertEqual(r.total_years, 3)

    def test_pg_research_explicit_4_confirmed(self):
        s = self.make_student(programme_type=ProgrammeType.POSTGRAD_RESEARCH,
                              programme_duration_years=4)
        r = resolve_total_years(s, row(None))
        self.assertEqual(r.total_years, 4)
        self.assertEqual(r.confidence, TenureConfidence.CONFIRMED)


class MissingProfileTypeTests(TenureTestCase):
    def test_numeric_level_infers_undergraduate_with_flag(self):
        s = self.make_student(programme_duration_years=4)  # no programme_type
        r = resolve_total_years(s, row('200'))
        self.assertEqual(r.programme_type, ProgrammeType.UNDERGRADUATE)
        self.assertEqual(r.total_years, 3)
        self.assertTrue(any("inferred 'undergraduate'" in f for f in r.flags))

    def test_no_type_and_unparseable_level_degrades_to_1(self):
        s = self.make_student()  # nothing on profile
        r = resolve_total_years(s, row('Postgraduate'))
        self.assertEqual(r.total_years, 1)
        self.assertEqual(r.confidence, TenureConfidence.DEGRADED)


class NeverRaisesTests(TenureTestCase):
    """Fuzz the resolver with garbage inputs — the approval transaction must
    survive all of them."""

    def test_garbage_inputs_all_degrade(self):
        # With and without a profile type, so the duration-inference path is
        # exercised with non-string course data too.
        typed = self.make_student(programme_type=ProgrammeType.UNDERGRADUATE)
        untyped = self.make_student()
        for bad_row in [
            row(None, None), row('', ''), row('abc', 123),
            row('Year One', None), row('HND1', ''), row('200', 123),
        ]:
            for s in (typed, untyped):
                r = resolve_total_years(s, bad_row)
                self.assertGreaterEqual(r.total_years, 1)
                self.assertLessEqual(r.total_years, MAX_TENURE)
