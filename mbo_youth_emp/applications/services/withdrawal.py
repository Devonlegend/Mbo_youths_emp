"""Shared approval-revocation (withdraw) service.

Both the verifier API action (:meth:`ApplicationViewSet.withdraw
<applications.views.ApplicationViewSet.withdraw>`) and the Django admin
"Withdraw application" pages route through :func:`withdraw_application` so the
two entry points cannot drift: the application is marked withdrawn, the status
transition is logged, and the scheme's slot is released back (see
:mod:`.slots`).
"""

from django.db import transaction

from ..models import ApplicationStatus, ApplicationStatusHistory
from .slots import release_slot


def withdraw_application(application, scheme, changed_by):
    """Revoke an approved application and release its slot.

    The caller is responsible for ensuring the application is currently
    ``APPROVED``.

    Returns ``(application, remaining_slots)`` after the change is committed.
    """
    from_status = application.status
    student     = application.student
    actor       = getattr(changed_by, 'full_name', '') or getattr(changed_by, 'email', '')

    with transaction.atomic():
        application.status = ApplicationStatus.WITHDRAWN
        application.save()

        ApplicationStatusHistory.objects.create(
            application_id = application.id,
            scheme         = scheme,
            from_status    = from_status,
            to_status      = ApplicationStatus.WITHDRAWN,
            changed_by     = changed_by,
            reason         = f'Approval withdrawn by {actor} — slot released',
        )

    # Give the slot back and clear the student's active-award label if it
    # points at this scheme, after the transaction commits.
    remaining = release_slot(scheme, student)

    return application, remaining
