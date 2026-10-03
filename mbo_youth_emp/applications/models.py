import uuid
from django.db import models


class ApplicationStatus(models.TextChoices):
    DRAFT           = 'draft',           'Draft'
    SUBMITTED       = 'submitted',       'Submitted'
    ELIGIBILITY_CHECK = 'eligibility_check', 'Under Eligibility Check'
    DOUBLE_DIP_FLAG = 'double_dip_flag', 'Flagged — Multiple Benefit Conflict'
    DOCUMENT_REVIEW = 'document_review', 'Documents Under Review'
    SHORTLISTED     = 'shortlisted',     'Shortlisted'
    APPROVED        = 'approved',        'Approved'
    REJECTED        = 'rejected',        'Rejected'
    WAIVER_REQUIRED = 'waiver_required', 'Awaiting Award Waiver'
    WITHDRAWN       = 'withdrawn',       'Withdrawn by Applicant'


# Statuses a verifier may act on. Includes DOUBLE_DIP_FLAG so a verifier can
# approve a flagged application directly (the approval is recorded as an
# override in the status history). The single source of truth for both the
# review endpoint and the `can_review` flag exposed to clients.
REVIEWABLE_STATUSES = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.DOCUMENT_REVIEW,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.WAIVER_REQUIRED,
    ApplicationStatus.DOUBLE_DIP_FLAG,
]


# ── Applications live in per-scheme tables ────────────────────────────────────
# There is no shared `Application` model. Each ScholarshipScheme owns its own
# physical table, built at runtime by applications/dynamic.py. The full set of
# application fields is defined there. The only managed application-side table is
# the status-history log below.


class ApplicationStatusHistory(models.Model):
    """Append-only log of status transitions for every application.

    Applications live in per-scheme tables, so this cannot hold a DB-level FK to
    a single application table. It stores the application's UUID plus its scheme
    (which identifies the table the application lives in).
    """
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application_id = models.UUIDField(db_index=True)
    scheme         = models.ForeignKey('schemes.ScholarshipScheme', on_delete=models.CASCADE,
                                       related_name='status_history')
    from_status    = models.CharField(max_length=30)
    to_status      = models.CharField(max_length=30)
    changed_by     = models.ForeignKey('accounts.User', on_delete=models.CASCADE)
    reason         = models.TextField(blank=True)
    changed_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['changed_at']

    def __str__(self):
        return f"{self.application_id}: {self.from_status} → {self.to_status}"


class PendingApplicationNotification(models.Model):
    """Approval emails held back until a reviewer Publishes a scheme.

    Applications live in per-scheme `managed=False` tables whose shape is fixed,
    so we track "approved but not yet emailed" here instead of adding a column
    to every dynamic table. A row is created when `review` approves an
    application; `sent_at` is stamped when the Publish endpoint enqueues the
    approval email. Rejection emails are deprecated and never tracked here.
    """
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application_id   = models.UUIDField(db_index=True)
    scheme           = models.ForeignKey('schemes.ScholarshipScheme', on_delete=models.CASCADE,
                                         related_name='pending_notifications')
    notification_type = models.CharField(max_length=10, choices=[('approved', 'Approved')])
    created_at       = models.DateTimeField(auto_now_add=True)
    sent_at          = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
        indexes = [models.Index(fields=['scheme', 'sent_at'])]

    def __str__(self):
        state = 'sent' if self.sent_at else 'pending'
        return f"{self.notification_type} {self.application_id} ({state})"


class Application(models.Model):
    """The unified application table (Phase 2).

    Applications currently still live in per-scheme dynamic tables (the write
    source of truth). This single, fully-typed table is a maintained replica of
    every application — populated by dual-write on each status transition
    (applications/signals.py) and backfilled with
    `manage.py rebuild_application_projection`. It carries the full row (common
    fields + every award type's answer columns + bank snapshot), so it can serve
    *both* list summaries and detail without touching the per-scheme tables.

    That makes cross-scheme reads (verifier queue, dashboards, admin list,
    `find_application`, per-scheme drill-downs) one indexed query instead of an
    O(N_schemes) scan, and is the stepping stone to dropping the dynamic tables
    entirely (see SYSTEM_DESIGN.md §5.3). Reads opt in via
    settings.APPLICATIONS_USE_PROJECTION so a live deployment backfills first.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student     = models.ForeignKey('students.Student', on_delete=models.CASCADE,
                                    related_name='applications')
    scheme      = models.ForeignKey('schemes.ScholarshipScheme', on_delete=models.CASCADE,
                                    related_name='applications')
    reviewed_by = models.ForeignKey('accounts.User', null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='+')

    status          = models.CharField(max_length=30, choices=ApplicationStatus.choices,
                                       default=ApplicationStatus.DRAFT)
    submission_date = models.DateTimeField(null=True, blank=True)

    self_declaration_received_support = models.BooleanField(null=True)
    self_declaration_details          = models.JSONField(default=list, blank=True)
    attestation_agreed = models.BooleanField(default=False)
    attestation_at     = models.DateTimeField(null=True, blank=True)
    documents          = models.JSONField(default=dict, blank=True)

    eligibility_passed  = models.BooleanField(null=True)
    eligibility_details = models.JSONField(default=dict)
    has_conflict        = models.BooleanField(default=False)
    conflict_scheme_ids = models.JSONField(default=list)
    waiver_submitted    = models.BooleanField(default=False)

    reviewed_at      = models.DateTimeField(null=True, blank=True)
    reviewer_notes   = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(auto_now=True)

    # Bank snapshot — collected fresh per application
    bank_name         = models.CharField(max_length=120, blank=True, default='')
    bank_code         = models.CharField(max_length=10, blank=True, default='')
    account_number    = models.CharField(max_length=20, blank=True, default='')
    account_name      = models.CharField(max_length=200, blank=True, default='')
    name_match_passed = models.BooleanField(default=False)

    # Award-type answers (nullable; only the relevant set is populated per row)
    institution_name = models.CharField(max_length=200, blank=True, default='')
    course_of_study  = models.CharField(max_length=200, blank=True, default='')
    current_level    = models.CharField(max_length=20, blank=True, default='')
    cgpa             = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    admission_year   = models.IntegerField(null=True, blank=True)
    matric_number    = models.CharField(max_length=50, blank=True, default='')

    trade_or_skill           = models.CharField(max_length=120, blank=True, default='')
    training_provider        = models.CharField(max_length=200, blank=True, default='')
    training_duration_months = models.PositiveSmallIntegerField(null=True, blank=True)
    prior_experience         = models.TextField(blank=True, default='')

    business_name        = models.CharField(max_length=200, blank=True, default='')
    business_stage       = models.CharField(max_length=30, blank=True, default='')
    business_description = models.TextField(blank=True, default='')
    requested_amount     = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    intended_use         = models.TextField(blank=True, default='')

    class Meta:
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['student', '-created_at']),
            models.Index(fields=['scheme', 'status']),
            models.Index(fields=['scheme', '-created_at']),
        ]

    def __str__(self):
        return f"Application({self.id}, {self.scheme_id}, {self.status})"
