# applications/services/eligibility.py

from decimal import Decimal


class CheckResult:
    """A single check result — passed or failed, with detail."""
    def __init__(self, passed: bool, **detail):
        self.passed = passed
        self.detail = detail

    def to_dict(self):
        return {"passed": self.passed, **self.detail}


class EligibilityEngine:
    @classmethod
    def run_full_check(cls, student, scheme) -> dict:
        """
        Master method. Runs every check and returns a complete result.

        Returns:
        {
            "eligible": bool,
            "has_conflict": bool,
            "conflict_scheme_ids": [...],
           ,
            "checks": { ... }
        }
        """
        checks      = {}

        # --- Run all checks ---
        checks['slots']          = cls._check_slots(scheme)
        checks['window']         = cls._check_application_window(scheme)
        checks['ward']           = cls._check_ward(student, scheme)
        checks['prior_awards']   = cls._check_prior_awards(student, scheme)
        checks['double_dip']     = cls._check_double_dip(student, scheme)

        # Award-type specific checks
        if scheme.award_type == 'scholarship':
            cgpa_result, _ = cls._check_cgpa(student, scheme)
            checks['cgpa']  = cgpa_result
            checks['level'] = cls._check_level(student, scheme)
        elif scheme.award_type == 'empowerment':
            checks['age']   = cls._check_age(student, scheme)
            checks['trade'] = cls._check_trade(student, scheme)
        elif scheme.award_type == 'grant':
            checks['age']   = cls._check_age(student, scheme)

        # --- Determine overall eligibility ---
        conflict_ids = checks['double_dip'].detail.get('conflicting_ids', [])
        has_conflict = bool(conflict_ids)

        # All checks must pass EXCEPT double_dip (that's handled separately)
        non_conflict_checks = {k: v for k, v in checks.items() if k != 'double_dip'}
        all_passed = all(v.passed for v in non_conflict_checks.values())

        return {
            "eligible":           all_passed and not has_conflict,
            "has_conflict":       has_conflict,
            "conflict_scheme_ids": conflict_ids,
            "checks":             {k: v.to_dict() for k, v in checks.items()},
        }

   
    @classmethod
    def _check_slots(cls, scheme) -> CheckResult:
        passed = scheme.remaining_slots > 0
        return CheckResult(
            passed,
            remaining_slots=scheme.remaining_slots,
            note="No slots remaining" if not passed else "Slots available"
        )

    @classmethod
    def _check_application_window(cls, scheme) -> CheckResult:
        passed = scheme.is_open()
        return CheckResult(
            passed,
            open_date=str(scheme.application_open_date),
            close_date=str(scheme.application_close_date),
            note="Application window is open" if passed else "Applications are closed"
        )

    @classmethod
    def _check_ward(cls, student, scheme) -> CheckResult:
        restricted = scheme.eligibility_criteria.get('ward_restriction')
        if not restricted:
            return CheckResult(True, note="No ward restriction")
        passed = student.ward in restricted
        return CheckResult(
            passed,
            student_ward=student.ward,
            allowed_wards=restricted
        )

    # _check_host_community removed — host-community gating is deprecated.
    # Any 'host_community_only' key in scheme.eligibility_criteria is now ignored.

    @classmethod
    def _check_cgpa(cls, student, scheme):
        """Returns (CheckResult, relaxation_string_or_None)"""
        min_cgpa   = Decimal(str(scheme.eligibility_criteria.get('min_cgpa', 0)))
        relaxation = None


        student_cgpa = student.cgpa or Decimal('0')
        passed       = student_cgpa >= min_cgpa

        return CheckResult(
            passed,
            student_cgpa=float(student_cgpa),
            required_cgpa=float(min_cgpa),
            relaxation_applied=relaxation is not None
        ), relaxation

    @classmethod
    def _check_level(cls, student, scheme) -> CheckResult:
        allowed = scheme.eligibility_criteria.get('allowed_levels', [])
        if not allowed:
            return CheckResult(True, note="No level restriction")
        passed = student.level in allowed
        return CheckResult(
            passed,
            student_level=student.level,
            allowed_levels=allowed
        )

    @classmethod
    def _check_age(cls, student, scheme) -> CheckResult:
     
        min_age = scheme.eligibility_criteria.get('min_age')
        max_age = scheme.eligibility_criteria.get('max_age')

        if not min_age and not max_age:
            return CheckResult(True, note="No age restriction")

        from django.utils import timezone
        if not hasattr(student, 'date_of_birth') or not student.date_of_birth:
            return CheckResult(False, note="Date of birth not set — cannot verify age")

        today = timezone.now().date()
        age   = (today - student.date_of_birth).days // 365

        passed = True
        if min_age:
            passed = passed and (age >= min_age)
        if max_age:
            passed = passed and (age <= max_age)

        return CheckResult(
            passed,
            student_age=age,
            min_age=min_age,
            max_age=max_age
        )

    @classmethod
    def _check_trade(cls, student, scheme) -> CheckResult:
        """For empowerment awards — check if student's trade matches."""
        allowed_trades = scheme.eligibility_criteria.get('allowed_trades')
        if not allowed_trades:
            return CheckResult(True, note="Open to all trades")

        student_trade = getattr(student, 'vocational_trade', None)
        if not student_trade:
            return CheckResult(False, note="No trade set on student profile")

        passed = student_trade in allowed_trades
        return CheckResult(
            passed,
            student_trade=student_trade,
            allowed_trades=allowed_trades
        )

    @classmethod
    def _check_prior_awards(cls, student, scheme) -> CheckResult:
        from applications.models import Application, ApplicationStatus

        max_prior = scheme.eligibility_criteria.get('max_prior_awards')
        if max_prior is None:
            return CheckResult(True, note="No prior award limit")

        prior_count = Application.objects.filter(
            student=student,
            scheme=scheme,
            status=ApplicationStatus.APPROVED
        ).count()

        passed = prior_count < max_prior
        return CheckResult(
            passed,
            prior_count=prior_count,
            max_allowed=max_prior
        )

    @classmethod
    def _check_double_dip(cls, student, scheme) -> CheckResult:
     
        from applications.models import Application, ApplicationStatus

        active_awards = Application.objects.filter(
            student=student,
            scheme__academic_year=scheme.academic_year,
            status=ApplicationStatus.APPROVED
        ).select_related('scheme')

        if not active_awards.exists():
            return CheckResult(True, conflicting_ids=[], note="No active awards found")

        conflicting_ids     = []
        conflict_details    = []

        for existing in active_awards:
            existing_scheme = existing.scheme

            is_cross_type = scheme.award_type != existing_scheme.award_type

            # RULE 2: Same-type conflicts depend on stacking policy
            is_same_type_conflict = (
                not is_cross_type and (
                    scheme.stacking_policy == 'exclusive' or
                    existing_scheme.stacking_policy == 'exclusive' or
                    (
                        scheme.stacking_policy == 'major_only' and
                        existing_scheme.stacking_policy == 'major_only' and
                        scheme.award_amount     >= 50000 and
                        existing_scheme.award_amount >= 50000
                    )
                )
            )

            if is_cross_type or is_same_type_conflict:
                conflicting_ids.append(str(existing_scheme.id))
                conflict_details.append({
                    "scheme_id":   str(existing_scheme.id),
                    "scheme_name": existing_scheme.name,
                    "award_type":  existing_scheme.award_type,
                    "reason": (
                        "Cross-type conflict: cannot hold awards of different types simultaneously"
                        if is_cross_type else
                        "Stacking policy conflict: award amounts exceed major threshold"
                    )
                })

        passed = len(conflicting_ids) == 0
        return CheckResult(
            passed,
            conflicting_ids=conflicting_ids,
            conflict_details=conflict_details,
            active_awards_count=active_awards.count()
        )