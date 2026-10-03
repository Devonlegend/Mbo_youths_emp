"""Keep the unified ``Application`` table and the per-scheme tables in sync.

Phase 2 transition:
* **Default (`APPLICATIONS_WRITE_UNIFIED=False`)** — the per-scheme tables are the
  write source of truth; the history signal projects each row into unified
  ``Application`` (read model).
* **Cutover (`APPLICATIONS_WRITE_UNIFIED=True`)** — the unified ``Application``
  table is the write source of truth; the history signal mirrors it back into the
  scheme's dynamic table so legacy consumers (email tasks, rollback) still work.

Both directions run through the ``ApplicationStatusHistory`` post-save signal —
the single chokepoint every status transition passes through.
"""

import logging

from django.conf import settings

from ..dynamic import get_application_model

logger = logging.getLogger(__name__)


def write_unified():
    """True when the unified Application table is the write source of truth."""
    return getattr(settings, 'APPLICATIONS_WRITE_UNIFIED', False)


# Columns copied between the source row and the unified Application. Names match
# on both sides; only those physically present on the source/destination are used.
_COPIED_FIELDS = [
    'status', 'submission_date',
    'self_declaration_received_support', 'self_declaration_details',
    'attestation_agreed', 'attestation_at', 'documents',
    'eligibility_passed', 'eligibility_details',
    'has_conflict', 'conflict_scheme_ids', 'waiver_submitted',
    'reviewed_at', 'reviewer_notes', 'rejection_reason',
    'created_at',
    'bank_name', 'bank_code', 'account_number', 'account_name', 'name_match_passed',
    # scholarship
    'institution_name', 'course_of_study', 'current_level', 'cgpa',
    'admission_year', 'matric_number',
    # empowerment
    'trade_or_skill', 'training_provider', 'training_duration_months',
    'prior_experience',
    # grant
    'business_name', 'business_stage', 'business_description',
    'requested_amount', 'intended_use',
]


def _present_fields(row):
    return {f.name for f in row._meta.fields}


def application_kwargs(scheme, row):
    """Map an application row (source) to unified Application kwargs."""
    present = _present_fields(row)
    data = {field: getattr(row, field) for field in _COPIED_FIELDS if field in present}
    data['id']             = row.id
    data['scheme']         = scheme
    data['student_id']     = row.student_id
    data['reviewed_by_id'] = row.reviewed_by_id
    return data


def legacy_kwargs(scheme, application):
    """Map a unified Application to kwargs for the scheme's dynamic model.

    Filtered to the destination table's fields — a scholarship table has no
    `trade_or_skill`, etc. — so the unified model's other-type columns are
    dropped rather than passed as invalid kwargs.
    """
    model = get_application_model(scheme)
    present = _present_fields(model)
    data = {field: getattr(application, field) for field in _COPIED_FIELDS if field in present}
    data['scheme']         = scheme
    data['student_id']     = application.student_id
    data['reviewed_by_id'] = application.reviewed_by_id
    return data


def upsert_application(scheme, application_id):
    """Project a source (dynamic) row into the unified Application table."""
    from ..models import Application

    row = get_application_model(scheme).objects.filter(id=application_id).first()
    if row is None:
        Application.objects.filter(id=application_id).delete()
        return None

    defaults = application_kwargs(scheme, row)
    defaults.pop('id', None)  # the pk is the lookup, not a default
    obj, _created = Application.objects.update_or_create(id=application_id, defaults=defaults)
    return obj


def mirror_to_legacy(scheme, application_id):
    """Mirror the unified Application back into the scheme's dynamic table.

    Only used during the walk-up to Phase 2 (``APPLICATIONS_WRITE_UNIFIED``) so
    the dynamic tables stay in sync for legacy consumers and rollback.
    """
    from ..models import Application

    application = Application.objects.filter(id=application_id).first()
    model = get_application_model(scheme)
    if application is None:
        model.objects.filter(id=application_id).delete()
        return None

    defaults = legacy_kwargs(scheme, application)
    obj, _created = model.objects.update_or_create(id=application_id, defaults=defaults)
    return obj
