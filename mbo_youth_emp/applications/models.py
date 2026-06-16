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
