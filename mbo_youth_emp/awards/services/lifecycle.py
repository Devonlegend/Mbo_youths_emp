"""Renewal / disbursement lifecycle for recurring scholarship awards.

Every transition is guarded by an explicit allowed-source-status check, so a
double-click or a retried request is a no-op or a clean 400 — never a
double-pay. Every mutation writes an :class:`AwardEvent` (the multi-year money
trail) and, for staff actions, an ``audit.record_admin_action`` row.

Installment transition table (any pair not listed here is rejected)::

    pending_renewal      student submits   -> pending_verification   (student)
    pending_verification approve           -> approved               (verifier)
    pending_verification reject            -> pending_renewal        (verifier)
                                              (cancelled + award suspended once
                                               the resubmission cap is reached)
    pending_verification withhold          -> withheld               (verifier)
                                              (+ award suspended)
    pending_renewal      grace expired     -> cancelled              (system)
                                              (+ award suspended)
    approved             mark paid         -> disbursed              (admin)
                                              (advances current_year_index;
                                               graduates on the final year)

The CGPA gate compares the **normalized** (5.0-scale) value against the
installment's snapshotted threshold. A threshold of 0 means "no gate".

``current_year_index`` is the highest DISBURSED payment year (0 until year 1
is paid) and is advanced *only* here, in :func:`disburse_installment`.
"""

import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.conf import settings
from django.utils import timezone

from accounts.validators import validate_upload, FileValidationError
from audit.services import record_admin_action
from notifications.helpers import (
    notify_award_graduated,
    notify_award_suspended,
    notify_installment_disbursed,
    notify_new_renewal_in_queue,
    notify_renewal_approved,
    notify_renewal_received,
    notify_renewal_rejected,
)

from ..models import (
    AwardEvent,
    AwardStatus,
    CgpaScale,
    InstallmentStatus,
)

logger = logging.getLogger(__name__)


class LifecycleError(Exception):
    """An invalid state transition or bad input. Views translate it to HTTP 400."""


# Rejects allowed per installment before it is cancelled and the award
# suspended ("repeated invalid submissions").
RESUBMISSION_CAP = getattr(settings, 'RENEWAL_RESUBMISSION_CAP', 2)


def normalize_cgpa(value, scale):
    """Return ``value`` expressed on the 5.0 scale, quantized to 2 dp."""
    try:
        value = Decimal(str(value))
        scale = Decimal(str(scale))
    except (InvalidOperation, TypeError, ValueError):
        raise LifecycleError('cgpa and cgpa_scale must be numbers.')
    if scale <= 0:
        raise LifecycleError('cgpa_scale must be positive.')
    return (value * Decimal('5') / scale).quantize(Decimal('0.01'),
                                                   rounding=ROUND_HALF_UP)


def _event(award, actor, action, note=''):
    """Append an AwardEvent. ``actor`` may be a User/Student or None (system)."""
    return AwardEvent.objects.create(
        award=award,
        actor=actor if getattr(actor, 'is_authenticated', False) else None,
        action=action,
        note=note,
    )


def _side_effect(label, fn, *args, **kwargs):
    """Run a notification/email side-effect without ever letting it break the
    state change that triggered it."""
    try:
        return fn(*args, **kwargs)
    except Exception:
        logger.exception('Award lifecycle side-effect failed: %s', label)


def _sync_active_award_label(student):
    """Keep Student.active_award in step with the student's live awards.

    The label is only a display convenience; conflict detection scans Award
    rows, never this field. Set it to the first remaining ACTIVE award's scheme
    name, or clear it when none remain.
    """
    from ..models import Award
    active = Award.objects.filter(
        student=student, status=AwardStatus.ACTIVE,
    ).select_related('scheme').first()
    student.active_award = active.scheme.name if active else ''
    student.save(update_fields=['active_award'])


def _suspend(award, actor, reason, event_action='suspended', note=''):
    award.status = AwardStatus.SUSPENDED
    award.suspended_reason = reason
    award.suspended_at = timezone.now()
    award.save(update_fields=['status', 'suspended_reason', 'suspended_at',
                              'updated_at'])
    _event(award, actor, event_action, note or reason)
    _side_effect('notify_award_suspended', notify_award_suspended, award, reason)


# ── Student: submit a yearly renewal ───────────────────────────────────────

def submit_renewal(*, award, student, cgpa, level, cgpa_scale=None,
                   transcript=None):
    """Student submits the CGPA/level/transcript for the open renewal year.

    Moves the installment ``pending_renewal`` -> ``pending_verification``.
    Not allowed on a ``withheld`` installment: a CGPA breach resumes only
    through an upheld appeal, never by re-submitting into the same year.
    """
    if award.student_id != student.pk:
        raise LifecycleError('You can only renew your own award.')
    if award.status != AwardStatus.ACTIVE:
        raise LifecycleError('This award is not active.')

    installment = (
        award.installments
        .filter(status=InstallmentStatus.PENDING_RENEWAL)
        .order_by('year_index')
        .first()
    )
    if installment is None:
        raise LifecycleError('There is no renewal open for this award.')

    scale = cgpa_scale or CgpaScale.FIVE
    if scale not in CgpaScale.values:
        raise LifecycleError("cgpa_scale must be '5.0' or '4.0'.")

    normalized = normalize_cgpa(cgpa, scale)
    try:
        raw = Decimal(str(cgpa))
    except (InvalidOperation, TypeError, ValueError):
        raise LifecycleError('cgpa must be a number.')
    if raw < 0 or raw > Decimal('99.99'):
        raise LifecycleError('cgpa is out of range.')

    if transcript is not None:
        try:
            validate_upload(transcript, 'transcript', required=False)
        except FileValidationError as exc:
            raise LifecycleError(str(exc)) from exc

    installment.submitted_cgpa = raw
    installment.submitted_cgpa_scale = scale
    installment.submitted_cgpa_normalized = normalized
    installment.submitted_level = str(level or '').strip()
    if transcript is not None:
        installment.transcript = transcript
    installment.status = InstallmentStatus.PENDING_VERIFICATION
    installment.save()

    _event(award, student, 'renewal.submitted',
           f'year {installment.year_index}: CGPA {raw}/{scale} '
           f'(normalized {normalized})')
    _side_effect('notify_renewal_received', notify_renewal_received, installment)
    _side_effect('notify_new_renewal_in_queue', notify_new_renewal_in_queue,
                 installment)
    return installment


# ── Verifier: approve / reject / withhold ──────────────────────────────────

def verify_installment(*, installment, verifier, action, note=''):
    """Verifier decision on a submitted renewal.

    ``approve`` is gated server-side on the normalized CGPA; below threshold
    the verifier must use ``withhold``. ``reject`` returns the installment to
    the student (``resubmission_count`` + 1) until the cap cancels it.
    """
    if installment.status != InstallmentStatus.PENDING_VERIFICATION:
        raise LifecycleError('This installment is not awaiting verification.')

    note = (note or '').strip()
    award = installment.award

    if action == 'approve':
        threshold = installment.threshold or Decimal('0')
        normalized = installment.submitted_cgpa_normalized
        if threshold > 0:
            if normalized is None:
                raise LifecycleError(
                    'No CGPA is on file to compare against the threshold.')
            if normalized < threshold:
                raise LifecycleError(
                    f'Submitted CGPA {normalized}/5.00 is below the required '
                    f'{threshold}/5.00 — use withhold instead.')
        installment.status = InstallmentStatus.APPROVED
        event_action = 'verified.approve'

    elif action == 'reject':
        if not note:
            raise LifecycleError('A note is required when rejecting a renewal.')
        installment.resubmission_count += 1
        if installment.resubmission_count >= RESUBMISSION_CAP:
            installment.status = InstallmentStatus.CANCELLED
            event_action = 'verified.reject.exhausted'
        else:
            installment.status = InstallmentStatus.PENDING_RENEWAL
            event_action = 'verified.reject'

    elif action == 'withhold':
        if not note:
            raise LifecycleError('A note is required when withholding a renewal.')
        installment.status = InstallmentStatus.WITHHELD
        event_action = 'verified.withhold'

    else:
        raise LifecycleError("action must be 'approve', 'reject' or 'withhold'.")

    installment.verified_by = verifier
    installment.verified_at = timezone.now()
    installment.verifier_note = note
    installment.save()

    # Suspension follows a withhold, or the final reject that exhausts the cap.
    if action == 'withhold':
        _suspend(award, verifier, 'CGPA below the renewal threshold',
                 event_action='suspended.cgpa', note=note)
    elif action == 'reject' and installment.status == InstallmentStatus.CANCELLED:
        _suspend(award, verifier, 'Repeated invalid renewal submissions',
                 event_action='suspended.resubmissions', note=note)

    _event(award, verifier, event_action,
           f'year {installment.year_index}' + (f': {note}' if note else ''))
    record_admin_action(
        verifier,
        f'Award renewal {action} — year {installment.year_index}',
        'Award',
        str(award.id),
    )

    if action == 'approve':
        _side_effect('notify_renewal_approved', notify_renewal_approved,
                     installment)
    elif action == 'reject':
        _side_effect('notify_renewal_rejected', notify_renewal_rejected,
                     installment, note)
    return installment


# ── Admin: disburse ────────────────────────────────────────────────────────

def disburse_installment(*, installment, admin, disbursement_ref=''):
    """Mark an approved installment paid. The ONLY place ``current_year_index``
    advances, and the ONLY path that graduates an award."""
    if installment.status != InstallmentStatus.APPROVED:
        raise LifecycleError('Only an approved installment can be disbursed.')

    award = installment.award
    installment.status = InstallmentStatus.DISBURSED
    installment.disbursed_at = timezone.now()
    installment.disbursement_ref = (disbursement_ref or '').strip()
    installment.save(update_fields=['status', 'disbursed_at', 'disbursement_ref',
                                    'updated_at'])

    award.current_year_index = installment.year_index
    graduated = installment.year_index >= award.total_years
    if graduated:
        award.status = AwardStatus.GRADUATED
    award.save(update_fields=['current_year_index', 'status', 'updated_at'])

    if graduated:
        _sync_active_award_label(award.student)

    _event(award, admin, 'disbursed',
           f'year {installment.year_index}'
           + (f' ref {installment.disbursement_ref}' if installment.disbursement_ref else ''))
    if graduated:
        _event(award, admin, 'graduated',
               f'all {award.total_years} payment years completed')

    record_admin_action(
        admin,
        f'Award installment disbursed — year {installment.year_index}',
        'Award',
        str(award.id),
    )

    _side_effect('notify_installment_disbursed', notify_installment_disbursed,
                 installment)
    if graduated:
        _side_effect('notify_award_graduated', notify_award_graduated, award)
    return award


# ── Admin: suspend / terminate overrides ───────────────────────────────────

def suspend_award(*, award, actor, reason=''):
    if award.status in (AwardStatus.TERMINATED, AwardStatus.GRADUATED):
        raise LifecycleError('A terminated or graduated award cannot be suspended.')
    if award.status == AwardStatus.SUSPENDED:
        raise LifecycleError('This award is already suspended.')
    _suspend(award, actor, reason or 'Suspended by administrator')
    record_admin_action(actor, 'Award suspended', 'Award', str(award.id))
    return award


def terminate_award(*, award, actor, reason=''):
    """Permanently end an award and cancel every non-disbursed installment.
    Disbursed money is terminal and never touched."""
    if award.status == AwardStatus.GRADUATED:
        raise LifecycleError('A graduated award is complete and cannot be terminated.')
    if award.status == AwardStatus.TERMINATED:
        raise LifecycleError('This award is already terminated.')

    for inst in award.installments.exclude(status=InstallmentStatus.DISBURSED):
        if inst.status != InstallmentStatus.CANCELLED:
            inst.status = InstallmentStatus.CANCELLED
            inst.save(update_fields=['status', 'updated_at'])

    award.status = AwardStatus.TERMINATED
    award.suspended_reason = reason or award.suspended_reason
    award.save(update_fields=['status', 'suspended_reason', 'updated_at'])
    _sync_active_award_label(award.student)

    _event(award, actor, 'terminated', reason or 'Terminated by administrator')
    record_admin_action(actor, 'Award terminated', 'Award', str(award.id))
    return award
