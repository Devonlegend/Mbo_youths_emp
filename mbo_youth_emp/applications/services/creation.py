"""Shared application-creation pipeline.

Both the student API (`ApplicationViewSet.submit`) and the staff admin page create
applications through `create_application` so the two paths cannot drift. The
function runs the EligibilityEngine, records its result, decides the initial
status (or honours a staff override), and writes the application row plus its
opening status-history entry atomically.

It deliberately does NOT do:
  * scheme open/slot gating or duplicate checks — those are caller policy
    (the API enforces them for students; staff may bypass them),
  * email notifications — the caller decides whether to notify.
"""

from django.db import transaction
from django.utils import timezone

from .eligibility import EligibilityEngine
from .projection import write_unified
from ..dynamic import get_application_model
from ..models import Application, ApplicationStatus, ApplicationStatusHistory


def decide_status(result):
    """Map an EligibilityEngine result to the initial application status.

    The engine no longer auto-rejects ineligible applications — a verifier
    reviews every application (eligible or not) and makes the final decision.
    Ineligible apps therefore land in SUBMITTED with eligibility_passed=False
    recorded so the verifier can see which checks failed. Only an active-award
    conflict short-circuits into the DOUBLE_DIP_FLAG waiver flow.
    """
    if result['has_conflict']:
        return ApplicationStatus.DOUBLE_DIP_FLAG
    return ApplicationStatus.SUBMITTED


def _sync_student_academics(student, scheme, answers):
    """Sync apply-time tenure fields onto Student (last-submit-wins).

    Scholarship-only. Called before eligibility so `_check_programme_type`
    and later tenure resolution see fresh values. Returns True when the
    student object was mutated (caller saves inside its transaction).
    """
    if scheme.award_type != 'scholarship':
        return False
    if not isinstance(answers, dict):
        return False
    if 'programme_type' not in answers:
        return False
    ptype = answers.get('programme_type') or ''
    student.faculty = (answers.get('faculty') or '').strip()
    student.programme_type = ptype
    student.programme_duration_years = answers.get('programme_duration_years')
    if ptype == 'undergraduate':
        student.entry_level = answers.get('entry_level')
    else:
        student.entry_level = None
    return True


def create_application(
    *,
    scheme,
    student,
    answers,
    bank,
    self_declaration_received_support,
    self_declaration_details=None,
    attestation_agreed,
    documents=None,
    changed_by,
    status_override=None,
    history_reason=None,
):
    """Create one application row in `scheme`'s table, atomically with its history.

    Args:
        scheme:   ScholarshipScheme the application belongs to.
        student:  students.Student applying.
        answers:  validated per-award answer dict (keys match the dynamic model).
        bank:     dict of bank snapshot fields (bank_name, bank_code,
                  account_number, account_name, name_match_passed).
        self_declaration_received_support: bool.
        self_declaration_details: list of prior-support entries.
        attestation_agreed: bool.
        documents: dict of document URLs.
        changed_by: accounts.User recorded on the opening history row.
        status_override: if given, this status is stored instead of the
                  engine-derived one (staff use). Eligibility is still recorded.
        history_reason: text for the opening history row; a sensible default is
                  used when omitted.

    Returns:
        (application_row, eligibility_result)
    """
    # Apply-time academics are the source of truth: sync onto Student first
    # (in-memory) so eligibility sees fresh values; the save happens atomically
    # with the application row below.
    _sync_student_academics(student, scheme, answers)

    result = EligibilityEngine.run_full_check(student, scheme, answers)

    status = status_override if status_override is not None else decide_status(result)

    if history_reason is None:
        history_reason = (
            'Auto-evaluated by EligibilityEngine'
            if status_override is None
            else f'Created by staff with status {status}'
        )

    now = timezone.now()
    with transaction.atomic():
        # Persist the Student sync with the application — never one without
        # the other. Only scholarship submits mutate these columns.
        if scheme.award_type == 'scholarship' and isinstance(answers, dict) \
                and 'programme_type' in answers:
            student.save(update_fields=[
                'faculty', 'programme_type',
                'programme_duration_years', 'entry_level',
            ])
        if write_unified():
            application = Application.objects.create(
                student=student, scheme=scheme, status=status, submission_date=now,
                self_declaration_received_support=self_declaration_received_support,
                self_declaration_details=self_declaration_details or [],
                attestation_agreed=attestation_agreed,
                attestation_at=now if attestation_agreed else None,
                documents=documents or {},
                eligibility_passed=result['eligible'],
                eligibility_details=result['checks'],
                has_conflict=result['has_conflict'],
                conflict_scheme_ids=result['conflict_scheme_ids'],
                created_at=now,
                **bank,
                **answers,
            )
        else:
            model = get_application_model(scheme)
            application = model.objects.create(
                student=student, scheme=scheme, status=status, submission_date=now,
                self_declaration_received_support=self_declaration_received_support,
                self_declaration_details=self_declaration_details or [],
                attestation_agreed=attestation_agreed,
                attestation_at=now if attestation_agreed else None,
                documents=documents or {},
                eligibility_passed=result['eligible'],
                eligibility_details=result['checks'],
                has_conflict=result['has_conflict'],
                conflict_scheme_ids=result['conflict_scheme_ids'],
                **bank,
                **answers,
            )

        ApplicationStatusHistory.objects.create(
            application_id = application.id,
            scheme         = scheme,
            from_status    = '',
            to_status      = status,
            changed_by     = changed_by,
            reason         = history_reason,
        )

    return application, result
