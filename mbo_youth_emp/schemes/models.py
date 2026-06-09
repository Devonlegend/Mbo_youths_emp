import uuid
from django.db import models


class AwardType(models.TextChoices):
    SCHOLARSHIP = 'scholarship', 'Scholarship (Academic)'
    EMPOWERMENT = 'empowerment', 'Empowerment / Vocational Training'
    GRANT       = 'grant',       'Grant'


class StackingPolicy(models.TextChoices):
    EXCLUSIVE   = 'exclusive',   'Exclusive — no other active awards allowed'
    MAJOR_ONLY  = 'major_only',  'Cannot stack with other major awards'
    OPEN        = 'open',        'Open — can stack with any award'


class SchemeProvider(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name         = models.CharField(max_length=200)
    provider_type = models.CharField(max_length=20, choices=[
        ('lga',       'LGA Council'),
        ('state',     'State Government'),
        ('corporate', 'Corporate / CSR'),
        ('ngo',       'NGO / Foundation'),
        ('federal',   'Federal Government'),
    ])
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ScholarshipScheme(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider         = models.ForeignKey(SchemeProvider, on_delete=models.CASCADE, related_name='schemes')
    name             = models.CharField(max_length=300)
    award_type       = models.CharField(max_length=20, choices=AwardType.choices, default=AwardType.SCHOLARSHIP)
    description      = models.TextField()
    academic_year    = models.CharField(max_length=9)   # "2024/2025"
    award_amount     = models.DecimalField(max_digits=12, decimal_places=2)
    total_slots      = models.IntegerField()
    remaining_slots  = models.IntegerField()
    stacking_policy  = models.CharField(max_length=20, choices=StackingPolicy.choices, default=StackingPolicy.MAJOR_ONLY)
    eligibility_criteria = models.JSONField(default=dict)
    """
    For scholarships:
    {
        "min_cgpa": 2.20,
        "allowed_levels": ["200", "300", "400"],
        "ward_restriction": ["effiat", "ewang"],
        "disability_relaxation": true,
        "max_prior_awards": 1
    }

    For empowerment:
    {
        "min_age": 16,
        "max_age": 35,
        "allowed_trades": ["welding", "tailoring", "ICT"],
        "ward_restriction": null,
        "disability_relaxation": true,
        "max_prior_awards": 1
    }

    For grant: same shape as empowerment (age + ward + prior limit).

   .
    """
    application_open_date  = models.DateField()
    application_close_date = models.DateField()
    is_active    = models.BooleanField(default=True)
    is_published = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.academic_year})"

    def is_open(self):
        from django.utils import timezone
        today = timezone.now().date()
        return self.is_published and (self.application_open_date <= today <= self.application_close_date)

    def has_slots(self):
        return self.remaining_slots > 0
    
class FieldType(models.TextChoices):
    TEXT     = 'text',     'Text Input'
    TEXTAREA = 'textarea', 'Text Area'
    SELECT   = 'select',   'Dropdown Select'
    RADIO    = 'radio',    'Radio Buttons'
    FILE     = 'file',     'File Upload'
    CHECKBOX = 'checkbox', 'Checkbox'
    NUMBER   = 'number',   'Number Input'


class SchemeFormField(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheme      = models.ForeignKey(ScholarshipScheme, on_delete=models.CASCADE, related_name='form_fields')
    field_name  = models.CharField(max_length=100)
    field_label = models.CharField(max_length=200)
    field_type  = models.CharField(max_length=20, choices=FieldType.choices)
    placeholder = models.CharField(max_length=200, blank=True)
    is_required = models.BooleanField(default=True)
    options     = models.JSONField(default=list, blank=True)
    # e.g. ["Option 1", "Option 2"] for select/radio
    order       = models.PositiveIntegerField(default=0)
    section     = models.CharField(max_length=100, blank=True)
    # groups fields under a section heading
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.scheme.name} — {self.field_label}"    