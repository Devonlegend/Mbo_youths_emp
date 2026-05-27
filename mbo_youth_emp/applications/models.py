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


class Application(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student         = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='applications')
    scheme          = models.ForeignKey('schemes.ScholarshipScheme', on_delete=models.CASCADE, related_name='applications')
    status          = models.CharField(max_length=30, choices=ApplicationStatus.choices, default=ApplicationStatus.DRAFT)
    submission_date = models.DateTimeField(null=True, blank=True)

    # Eligibility result — populated by EligibilityEngine
    eligibility_passed  = models.BooleanField(null=True)
    eligibility_details = models.JSONField(default=dict)

    # CBR conflict tracking
    has_conflict       = models.BooleanField(default=False)
    conflict_scheme_ids = models.JSONField(default=list)

    # Waiver
    waiver_submitted   = models.BooleanField(default=False)

    # Review
    reviewed_by     = models.ForeignKey('accounts.User', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='reviewed_applications')
    reviewed_at     = models.DateTimeField(null=True, blank=True)
    reviewer_notes  = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # One application per student per scheme — enforced at DB level
        unique_together = ['student', 'scheme']

    def __str__(self):
        return f"{self.student.full_name} → {self.scheme.name} [{self.status}]"


class ApplicationStatusHistory(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=30)
    to_status   = models.CharField(max_length=30)
    changed_by  = models.ForeignKey('accounts.User', on_delete=models.CASCADE)
    reason      = models.TextField(blank=True)
    changed_at  = models.DateTimeField(auto_now_add=True)