"""Keep the unified ``Application`` table in sync with the per-scheme tables.

The per-scheme dynamic tables are still the write source of truth; this module
projects each application into the single unified ``Application`` table. Called
from the ``ApplicationStatusHistory`` post-save signal (every status transition
writes a history row), so all write paths — submit, staff create, waiver, review,
withdrawal — stay in sync without touching each one individually.

This is the Phase-2 foundation: once the projection is trusted, reads switch to
``Application`` and the dynamic tables can be dropped (see SYSTEM_DESIGN.md).
"""

import logging

from ..dynamic import get_application_model

logger = logging.getLogger(__name__)


# Scalar/shared columns copied verbatim from the source row. Field names match
# the unified Application model exactly.
_COPIED_FIELDS = [
    'status', 'submission_date',
    'self_declaration_received_support', 'self_declaration_details',
    'attestation_agreed', 'attestation_at', 'documents',
    'eligibility_passed', 'eligibility_details',
    'has_conflict', 'conflict_scheme_ids', 'waiver_submitted',
    'reviewed_at', 'reviewer_notes', 'rejection_reason',
    'created_at', 'updated_at',
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


def application_kwargs(scheme, row):
    """Map an application row to unified Application constructor kwargs.

    Only copies fields that physically exist on the source row — each scheme
    table carries just its award type's answer columns — so the unified model
    falls back to its defaults for the rest. Award type is immutable per scheme,
    so a field is never expected to change type over the row's life.
    """
    present = {f.name for f in row._meta.fields}
    data = {field: getattr(row, field) for field in _COPIED_FIELDS if field in present}
    data['id']             = row.id
    data['scheme']         = scheme
    data['student_id']     = row.student_id
    data['reviewed_by_id'] = row.reviewed_by_id
    return data


def upsert_application(scheme, application_id):
    """Create/update the unified Application row for one application.

    Re-reads the source row so status/eligibility/waiver/details changes are all
    captured. If the row no longer exists, the unified row is removed. Returns
    the Application (or None if the source application is gone).
    """
    from ..models import Application

    row = get_application_model(scheme).objects.filter(id=application_id).first()
    if row is None:
        Application.objects.filter(id=application_id).delete()
        return None

    defaults = application_kwargs(scheme, row)
    defaults.pop('id', None)  # the pk is the lookup, not a default
    obj, _created = Application.objects.update_or_create(
        id=application_id,
        defaults=defaults,
    )
    return obj
