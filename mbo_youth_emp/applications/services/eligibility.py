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
    def run_full_check(cls, student, scheme, details=None) -> dict:
        """
        Master method. Runs every check and returns a complete result.

        `details` is the validated per-award submission payload (the
        `validated_data` from the scholarship/empowerment/grant serializer).
        Award-type-specific checks (cgpa, level, trade) read the values the
        applicant submitted with *this* application rather than stale profile
        fields. It defaults to {} so the engine still runs without a payload.

        Returns:
        {
            "eligible": bool,
            "has_conflict": bool,
            "conflict_scheme_ids": [...],
           ,
            "checks": { ... }
        }
        """
        details     = details or {}
        checks      = {}

        # --- Run all checks ---
        checks['slots']          = cls._check_slots(scheme)
        checks['window']         = cls._check_application_window(scheme)
        checks['ward']           = cls._check_ward(student, scheme)
        checks['prior_awards']   = cls._check_prior_awards(student, scheme)
        checks['double_dip']     = cls._check_double_dip(student, scheme)

        # Award-type specific checks — sourced from the submitted `details`.
        if scheme.award_type == 'scholarship':
            cgpa_result, _ = cls._check_cgpa(student, scheme, details)
            checks['cgpa']  = cgpa_result
            checks['level'] = cls._check_level(student, scheme, details)
        elif scheme.award_type == 'empowerment':
            checks['age']   = cls._check_age(student, scheme)
            checks['trade'] = cls._check_trade(student, scheme, details)
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


    @classmethod
    def _check_cgpa(cls, student, scheme, details=None):
        """Returns (CheckResult, relaxation_string_or_None)"""
        details    = details or {}
        min_cgpa   = Decimal(str(scheme.eligibility_criteria.get('min_cgpa', 0)))
        relaxation = None

        # CGPA submitted with this application takes precedence over the profile.
        submitted    = details.get('cgpa')
        raw_cgpa     = submitted if submitted is not None else (student.cgpa or Decimal('0'))
        student_cgpa = Decimal(str(raw_cgpa))
        passed       = student_cgpa >= min_cgpa

        return CheckResult(
            passed,
            student_cgpa=float(student_cgpa),
            required_cgpa=float(min_cgpa),
            relaxation_applied=relaxation is not None
        ), relaxation

    @classmethod
    def _check_level(cls, student, scheme, details=None) -> CheckResult:
        details = details or {}
        allowed = scheme.eligibility_criteria.get('allowed_levels', [])
        if not allowed:
            return CheckResult(True, note="No level restriction")
        # Level submitted with this application takes precedence over the profile.
        level = details.get('current_level', student.level)
        # eligibility_criteria is admin-authored JSON (levels may be "200" or 200)
        # and the level may be an int — compare as strings so they always line up.
        allowed_str = [str(lvl) for lvl in allowed]
        passed = str(level) in allowed_str
        return CheckResult(
            passed,
            student_level=level,
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
    def _check_trade(cls, student, scheme, details=None) -> CheckResult:
        """For empowerment awards — check the submitted trade against the scheme."""
        details = details or {}
        allowed_trades = scheme.eligibility_criteria.get('allowed_trades')
        if not allowed_trades:
            return CheckResult(True, note="Open to all trades")

        # The trade comes from the empowerment submission (`trade_or_skill`).
        student_trade = details.get('trade_or_skill')
        if not student_trade:
            return CheckResult(False, note="No trade provided in application")

        passed = student_trade in allowed_trades
        return CheckResult(
            passed,
            student_trade=student_trade,
            allowed_trades=allowed_trades
        )

    @classmethod
    def _check_prior_awards(cls, student, scheme) -> CheckResult:
        from applications.dynamic import get_application_model
        from applications.models import ApplicationStatus

        max_prior = scheme.eligibility_criteria.get('max_prior_awards')
        if max_prior is None:
            return CheckResult(True, note="No prior award limit")

        # Prior awards for THIS scheme = approved rows in this scheme's own table.
        model = get_application_model(scheme)
        prior_count = model.objects.filter(
            student=student,
            status=ApplicationStatus.APPROVED,
        ).count()

        passed = prior_count < max_prior
        return CheckResult(
            passed,
            prior_count=prior_count,
            max_allowed=max_prior
        )

    @classmethod
    def _check_double_dip(cls, student, scheme) -> CheckResult:
        # Applications live in per-scheme tables, so a same-academic-year scan is a
        # UNION over every scheme's table.
        from applications.dynamic import iter_application_models
        from applications.models import ApplicationStatus

        conflicting_ids  = []
        conflict_details = []
        active_count     = 0

        for existing_scheme, model in iter_application_models():
            if existing_scheme.academic_year != scheme.academic_year:
                continue

            approved = model.objects.filter(
                student=student,
                status=ApplicationStatus.APPROVED,
            )
            for _existing in approved:
                active_count += 1

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

        if active_count == 0:
            return CheckResult(True, conflicting_ids=[], note="No active awards found")

        passed = len(conflicting_ids) == 0
        return CheckResult(
            passed,
            conflicting_ids=conflicting_ids,
            conflict_details=conflict_details,
            active_awards_count=active_count
        )