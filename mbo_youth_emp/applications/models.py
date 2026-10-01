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


class ApplicationIndex(models.Model):
    """Cross-scheme read model (CQRS projection) for applications.

    Applications live in per-scheme physical tables, so a cross-scheme read
    (verifier queue, dashboards, the admin list) would otherwise loop over every
    scheme table and sort the whole result in Python. This single indexed table
    mirrors exactly the fields those *summaries* need, so they become one indexed
    query with SQL-side pagination.

    The per-scheme table stays the source of truth for full detail. Rows are
    kept in sync on every status transition (see applications/signals.py) and can
    be rebuilt with `manage.py rebuild_application_index`. Reads opt in via
    settings.APPLICATIONS_USE_INDEX so a live deployment can backfill before the
    switch flips.

    The list serializer reads `.id` and `.get_status_display()`, so `id` is
    exposed as a property and `status` carries choices — meaning the existing
    `serialize_application_list` works on an index row unchanged.
    """
    application_id = models.UUIDField(primary_key=True)
    scheme  = models.ForeignKey('schemes.ScholarshipScheme', on_delete=models.CASCADE,
                                related_name='+')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE,
                                related_name='+')

    status             = models.CharField(max_length=30, choices=ApplicationStatus.choices)
    submission_date    = models.DateTimeField(null=True, blank=True)
    eligibility_passed = models.BooleanField(null=True)
    has_conflict       = models.BooleanField(default=False)
    waiver_submitted   = models.BooleanField(default=False)

    created_at = models.DateTimeField()          # mirrors the application row
    indexed_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['student', '-created_at']),
            models.Index(fields=['scheme', 'status']),
        ]

    @property
    def id(self):
        return self.application_id

    def __str__(self):
        return f"ApplicationIndex({self.application_id}, {self.status})"
