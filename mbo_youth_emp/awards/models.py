"""Recurring (multi-year) scholarship awards.

An Award is the multi-year contract created when a recurring-scholarship
application is approved. Each payment year is an AwardInstallment, renewed
per Cycle and gated on a CGPA threshold snapshotted at creation time (scheme
edits never retroactively change obligations). Suspension → appeal is the
breach path; AwardEvent is the audit trail for every state change.

Money/discipline rules enforced at the service layer (services/lifecycle.py):
  * `disbursed` installments are terminal — corrections are new adjusting
    records, never edits.
  * Award.scheme is PROTECT — financial obligations are never silently lost
    when a scheme is deleted; terminate awards first.
"""

import uuid

from django.db import models

from accounts.models import User
from schemes.models import Cycle, ScholarshipScheme
from students.models import Student
from .services.tenure import TenureConfidence


class AwardStatus(models.TextChoices):
    ACTIVE     = 'active',     'Active'
    SUSPENDED  = 'suspended',  'Suspended'
    GRADUATED  = 'graduated',  'Graduated'
    TERMINATED = 'terminated', 'Terminated'
    # Note: "appeal pending" is NOT a status — it is derived from an
    # AwardAppeal row in `pending` on a suspended award.


class InstallmentStatus(models.TextChoices):
    PENDING_RENEWAL      = 'pending_renewal',      'Pending renewal'       # student's turn
    PENDING_VERIFICATION = 'pending_verification', 'Pending verification'  # staff's turn
    APPROVED             = 'approved',             'Approved'              # queued for payment
    DISBURSED            = 'disbursed',            'Disbursed'             # terminal
    WITHHELD             = 'withheld',             'Withheld'              # CGPA breach → award suspended
    CANCELLED            = 'cancelled',            'Cancelled'             # no submission in grace window


class AppealStatus(models.TextChoices):
    PENDING  = 'pending',  'Pending'
    UPHELD   = 'upheld',   'Upheld'
    REJECTED = 'rejected', 'Rejected'


class CgpaScale(models.TextChoices):
    FIVE = '5.0', '5.0 scale'
    FOUR = '4.0', '4.0 scale'


class Award(models.Model):
    """The multi-year contract — one per approved recurring application."""
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='awards')
    # PROTECT: a scheme with live financial obligations cannot be deleted.
    scheme  = models.ForeignKey(ScholarshipScheme, on_delete=models.PROTECT, related_name='awards')
    # Plain UUID, NOT a FK — application rows live in per-scheme dynamic
    # tables, so a database-level FK is impossible. Same approach as
    # ApplicationStatusHistory.
    application_id = models.UUIDField(unique=True)

    total_years    = models.PositiveSmallIntegerField()
    start_cycle    = models.ForeignKey(Cycle, on_delete=models.PROTECT, related_name='awards_started')
    annual_amount  = models.DecimalField(max_digits=12, decimal_places=2)  # snapshot of scheme.award_amount; admin-overridable
    min_cgpa_snapshot = models.DecimalField(max_digits=4, decimal_places=2)  # threshold in force at creation

    # Paid-years counter: the highest DISBURSED payment year, 0 until year 1
    # is paid. Advances on disbursement only, never on installment creation
    # (see awards/services/lifecycle.py). The in-progress year is index + 1.
    current_year_index = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=20, choices=AwardStatus.choices, default=AwardStatus.ACTIVE)
    suspended_reason = models.TextField(blank=True)
    suspended_at     = models.DateTimeField(null=True, blank=True)

    # Output of the tenure resolver (services/tenure.py) at creation. Anything
    # other than CONFIRMED means a human should verify total_years.
    tenure_confidence = models.CharField(max_length=20, default=TenureConfidence.CONFIRMED)
    tenure_flags      = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['scheme', 'status']),
            models.Index(fields=['student', 'status']),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(current_year_index__lte=models.F('total_years')),
                name='award_year_index_within_total',
            ),
        ]

    def __str__(self):
        return f"{self.student.full_name} — {self.scheme.name} (year {self.current_year_index}/{self.total_years})"


class AwardInstallment(models.Model):
    """One row per payment year of an Award."""
    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    award = models.ForeignKey(Award, on_delete=models.CASCADE, related_name='installments')
    year_index = models.PositiveSmallIntegerField()  # 1..award.total_years
    cycle = models.ForeignKey(Cycle, on_delete=models.PROTECT, related_name='installments')

    amount    = models.DecimalField(max_digits=12, decimal_places=2)  # snapshot
    threshold = models.DecimalField(max_digits=4, decimal_places=2)    # CGPA threshold this installment is judged on (snapshot)
    status    = models.CharField(max_length=30, choices=InstallmentStatus.choices,
                                 default=InstallmentStatus.PENDING_RENEWAL)

    # Student's renewal submission. Raw CGPA + its scale are stored alongside
    # the normalized (5.0-scale) value used for threshold comparison.
    submitted_cgpa            = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    submitted_cgpa_scale      = models.CharField(max_length=4, choices=CgpaScale.choices,
                                                 default=CgpaScale.FIVE, blank=True)
    submitted_cgpa_normalized = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    submitted_level           = models.CharField(max_length=20, blank=True)  # level they're ENTERING
    transcript                = models.FileField(upload_to='award_renewals/', null=True, blank=True)

    resubmission_count = models.PositiveSmallIntegerField(default=0)  # quality rejects, capped in service layer

    verified_by = models.ForeignKey(User, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='verified_installments')
    verified_at  = models.DateTimeField(null=True, blank=True)
    verifier_note = models.TextField(blank=True)

    disbursed_at    = models.DateTimeField(null=True, blank=True)
    disbursement_ref = models.CharField(max_length=120, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['award', 'year_index'], name='unique_installment_per_year'),
        ]
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['cycle', 'status']),
            models.Index(fields=['award', 'year_index']),
        ]
        ordering = ['year_index']

    def __str__(self):
        return f"{self.award} — year {self.year_index} ({self.status})"


class AwardAppeal(models.Model):
    """A suspended award's appeal against a withheld installment."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    award       = models.ForeignKey(Award, on_delete=models.CASCADE, related_name='appeals')
    installment = models.ForeignKey(AwardInstallment, on_delete=models.CASCADE, related_name='appeals')
    reason      = models.TextField()
    evidence    = models.FileField(upload_to='award_appeals/', null=True, blank=True)

    status       = models.CharField(max_length=20, choices=AppealStatus.choices, default=AppealStatus.PENDING)
    reviewed_by  = models.ForeignKey(User, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name='reviewed_appeals')
    reviewed_at  = models.DateTimeField(null=True, blank=True)
    review_note  = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['status'])]
        # One pending appeal per installment is enforced in the service layer
        # (partial unique indexes are Postgres-only; dev runs SQLite).

    def __str__(self):
        return f"Appeal({self.award_id}, year {self.installment.year_index}, {self.status})"


class AwardEvent(models.Model):
    """Append-only audit trail for every award state change. Mandatory — this
    is a multi-year money trail across multiple actors; retrofitting history
    later is not an option. Complements audit.record_admin_action (which is
    admin-action-scoped) by also capturing system/student events."""
    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    award = models.ForeignKey(Award, on_delete=models.CASCADE, related_name='events')
    actor = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL,
                              related_name='+')  # null = system (e.g. cycle rollover)
    action = models.CharField(max_length=60)     # e.g. 'created', 'renewed', 'verified.approve', 'suspended'
    note   = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [models.Index(fields=['award', 'created_at'])]

    def __str__(self):
        return f"{self.award_id}:{self.action} @ {self.created_at:%Y-%m-%d}"
