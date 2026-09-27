"""Award creation on application approval.

Called from inside review()'s / staff_create's transaction.atomic() approval
block (applications/views.py) when the scheme is a recurring scholarship.
Idempotent by design — the unique(application_id) constraint plus the
exists() guard mean a retried approval can never create two awards.

Year-1 installment is created APPROVED (approval = first payment queued),
consistent with one-shot semantics: it moves to DISBURSED when an admin marks
it paid.
"""

from django.utils import timezone

from schemes.models import Cycle
from ..models import Award, AwardEvent, AwardInstallment, AwardStatus, InstallmentStatus
from .tenure import resolve_total_years


def renewal_threshold_for(scheme):
    """The yearly CGPA gate for a recurring scheme: the explicit renewal
    threshold when set, else the application-time minimum."""
    if scheme.min_renewal_cgpa is not None:
        return scheme.min_renewal_cgpa
    min_cgpa = (scheme.eligibility_criteria or {}).get('min_cgpa')
    # A scheme with no threshold at all shouldn't recur — but never block
    # award creation; 0.00 means "no CGPA gate" and is flagged via tenure.
    return min_cgpa if min_cgpa is not None else 0


def create_award(*, student, scheme, application, actor):
    """Create the Award (+ year-1 installment + event) for an approved
    recurring application. Returns the Award, or None if one already exists
    for this application (idempotent no-op).

    Must be called inside the caller's transaction — it participates in the
    approval's atomicity rather than opening its own.
    """
    if Award.objects.filter(application_id=application.id).exists():
        return None

    tenure = resolve_total_years(student, application)
    cycle  = scheme.cycle or Cycle.get_active()

    award = Award.objects.create(
        student=student,
        scheme=scheme,
        application_id=application.id,
        total_years=tenure.total_years,
        start_cycle=cycle,
        annual_amount=scheme.award_amount,
        min_cgpa_snapshot=renewal_threshold_for(scheme),
        current_year_index=0,  # no payment disbursed yet (see lifecycle.disburse_installment)
        tenure_confidence=tenure.confidence,
        tenure_flags=tenure.flags,
    )

    AwardInstallment.objects.create(
        award=award,
        year_index=1,
        cycle=cycle,
        amount=award.annual_amount,
        threshold=award.min_cgpa_snapshot,
        status=InstallmentStatus.APPROVED,  # approval = first payment queued
    )

    note = f"total_years={tenure.total_years} ({tenure.confidence})"
    if tenure.flags:
        note += " — " + "; ".join(tenure.flags)
    AwardEvent.objects.create(award=award, actor=actor, action='created', note=note)

    return award


def terminate_award_for_withdrawal(*, application, actor):
    """Cascade for application withdrawal: terminate the linked Award and
    cancel its non-disbursed installments. Disbursed money is never touched
    (disbursed is terminal). No-op when no award exists (one-shot schemes).
    """
    award = Award.objects.filter(application_id=application.id).first()
    if award is None:
        return None

    now = timezone.now()
    for inst in award.installments.exclude(status=InstallmentStatus.DISBURSED):
        inst.status = InstallmentStatus.CANCELLED
        inst.save(update_fields=['status', 'updated_at'])

    award.status = AwardStatus.TERMINATED
    award.suspended_reason = ''  # not a suspension; keep reason fields clean
    award.save(update_fields=['status', 'suspended_reason', 'updated_at'])

    AwardEvent.objects.create(
        award=award, actor=actor, action='terminated.withdrawal',
        note='Application approval withdrawn; non-disbursed installments cancelled.',
    )
    return award
