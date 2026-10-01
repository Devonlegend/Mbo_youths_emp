"""Keep the cross-scheme ``ApplicationIndex`` read model in sync.

The per-scheme application tables are the source of truth; this module projects
each application into one indexed row. Called from the ``ApplicationStatusHistory``
post-save signal (every status transition writes a history row), so all write
paths — student submit, staff create, waiver, review, withdrawal — stay in sync
without touching each one individually.
"""

import logging

from ..dynamic import get_application_model

logger = logging.getLogger(__name__)


def index_kwargs(scheme, row):
    """Map an application row to ApplicationIndex constructor kwargs."""
    return {
        'application_id':     row.id,
        'scheme':             scheme,
        'student_id':         row.student_id,
        'status':             row.status,
        'submission_date':    row.submission_date,
        'eligibility_passed': row.eligibility_passed,
        'has_conflict':       row.has_conflict,
        'waiver_submitted':   row.waiver_submitted,
        'created_at':         row.created_at,
    }


def upsert_application_index(scheme, application_id):
    """Create/update the index row for one application.

    Re-reads the application row so status/eligibility/waiver changes are all
    captured. If the row no longer exists, the index row is removed. Returns the
    ApplicationIndex (or None if the application is gone).
    """
    from ..models import ApplicationIndex

    row = get_application_model(scheme).objects.filter(id=application_id).first()
    if row is None:
        ApplicationIndex.objects.filter(application_id=application_id).delete()
        return None

    obj, _created = ApplicationIndex.objects.update_or_create(
        application_id=application_id,
        defaults=index_kwargs(scheme, row),
    )
    return obj
