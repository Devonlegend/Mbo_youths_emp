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


# ──────────────────────────── per-award detail tables ────────────────────────────
# Each award type captures different submission-time information. Exactly one of
# the three detail rows is created per Application, based on scheme.award_type.
# Bank details are duplicated on each so a student can route different awards to
# different accounts and so disbursement records are immutable per application.


class _BankDetailsMixin(models.Model):
    bank_name      = models.CharField(max_length=120)
    account_number = models.CharField(max_length=20)
    account_name   = models.CharField(max_length=200)

    class Meta:
        abstract = True


class ScholarshipDetails(_BankDetailsMixin):
    application      = models.OneToOneField(Application, on_delete=models.CASCADE, related_name='scholarship_details', primary_key=True)
    institution_name = models.CharField(max_length=200)
    course_of_study  = models.CharField(max_length=200)
    current_level    = models.CharField(max_length=20)
    cgpa             = models.DecimalField(max_digits=4, decimal_places=2)
    admission_year   = models.IntegerField()
    matric_number    = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f"ScholarshipDetails({self.application_id})"


class EmpowermentDetails(_BankDetailsMixin):
    application              = models.OneToOneField(Application, on_delete=models.CASCADE, related_name='empowerment_details', primary_key=True)
    trade_or_skill           = models.CharField(max_length=120)
    training_provider        = models.CharField(max_length=200, blank=True)
    training_duration_months = models.PositiveSmallIntegerField(null=True, blank=True)
    prior_experience         = models.TextField(blank=True)

    def __str__(self):
        return f"EmpowermentDetails({self.application_id})"


class GrantDetails(_BankDetailsMixin):
    application         = models.OneToOneField(Application, on_delete=models.CASCADE, related_name='grant_details', primary_key=True)
    business_name       = models.CharField(max_length=200)
    business_stage      = models.CharField(max_length=30, choices=[
        ('idea',     'Idea Stage'),
        ('startup',  'Startup / Early-stage'),
        ('growth',   'Growth Stage'),
        ('mature',   'Established'),
    ])
    business_description = models.TextField()
    requested_amount     = models.DecimalField(max_digits=12, decimal_places=2)
    intended_use         = models.TextField()

    def __str__(self):
        return f"GrantDetails({self.application_id})"