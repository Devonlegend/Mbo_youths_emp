"""Atomic slot bookkeeping shared by the approval and withdrawal paths.

`remaining_slots` on a scheme is the live count of how many awards can still be
handed out. It is:

  * decremented exactly ONCE, when an application is approved
    (`review` / staff override / admin form — see `consume_slot`), and
  * incremented exactly ONCE, when an approval is revoked (`withdraw` — see
    `release_slot`).

Both operations use an atomic ``F()`` update on the database column rather than
the old read-modify-write (``remaining_slots = max(0, remaining_slots - 1)``),
so two concurrent requests can never over-consume or lose a released slot.
"""

from django.db.models import F

from schemes.models import ScholarshipScheme


class SlotUnavailable(Exception):
    """Raised when an approval is attempted with no remaining slots.

    View code raises this inside a ``transaction.atomic()`` block when
    ``consume_slot`` returns ``False``; the transaction rolls back and the
    caller converts it into an HTTP 400 response. Raising (rather than calling
    ``transaction.set_rollback`` and returning) keeps the atomic block from
    ending in a pending-rollback state, which Django would otherwise reject
    with a TransactionManagementError.
    """


def consume_slot(scheme) -> bool:
    """Atomically take one slot from ``scheme``.

    Returns ``True`` if a slot was actually consumed (``remaining_slots`` was
    strictly greater than zero), ``False`` if the scheme is already full — in
    which case nothing is changed. The caller is expected to refuse the approval
    when this returns ``False``.

    ``scheme`` is refreshed from the DB so its in-memory ``remaining_slots`` is
    accurate for any follow-up response/render in the same request.
    """
    if scheme is None or not scheme.pk:
        return False

    taken = ScholarshipScheme.objects.filter(
        pk=scheme.pk,
        remaining_slots__gt=0,
    ).update(remaining_slots=F('remaining_slots') - 1)

    if taken:
        scheme.refresh_from_db(fields=['remaining_slots'])
    return bool(taken)


def release_slot(scheme, student=None):
    """Atomically give one slot back to ``scheme``.

    Returns the updated ``remaining_slots`` count. When ``student`` is supplied
    and their ``active_award`` label points at this scheme's name, that label is
    cleared too — the withdraw path uses this to undo an approval.

    NOTE: ``active_award`` is a single free-text label, so it is only cleared
    when it *exactly* matches this scheme's name; other active awards are left
    untouched.
    """
    if scheme is None or not scheme.pk:
        return getattr(scheme, 'remaining_slots', None)

    ScholarshipScheme.objects.filter(pk=scheme.pk).update(
        remaining_slots=F('remaining_slots') + 1,
    )
    scheme.refresh_from_db(fields=['remaining_slots'])

    if student is not None and getattr(student, 'active_award', '') == scheme.name:
        student.active_award = ''
        student.save(update_fields=['active_award'])

    return scheme.remaining_slots
