# applications/serializers.py

from rest_framework import serializers

from .models import ApplicationStatus, ApplicationStatusHistory, REVIEWABLE_STATUSES


# ── Nested serializers ────────────────────────────────────────────────────────

class SchemeProviderNestedSerializer(serializers.Serializer):
    id            = serializers.UUIDField()
    name          = serializers.CharField()
    provider_type = serializers.CharField()


class SchemeNestedSerializer(serializers.Serializer):
    id                     = serializers.UUIDField()
    name                   = serializers.CharField()
    award_type             = serializers.CharField()
    award_type_display     = serializers.SerializerMethodField()
    award_amount           = serializers.DecimalField(max_digits=12, decimal_places=2)
    academic_year          = serializers.CharField()
    application_open_date  = serializers.DateField()
    application_close_date = serializers.DateField()
    provider               = SchemeProviderNestedSerializer()

    def get_award_type_display(self, obj):
        return obj.get_award_type_display() if hasattr(obj, 'get_award_type_display') else obj.award_type


class StudentNestedSerializer(serializers.Serializer):
    id                = serializers.UUIDField(source='user_id')
    full_name         = serializers.CharField()
    ward              = serializers.CharField()
    level             = serializers.CharField(allow_null=True)
    cgpa              = serializers.DecimalField(max_digits=4, decimal_places=2, allow_null=True)
    nimc_verified     = serializers.BooleanField(source='is_verified')


# ── Per-award-type programme-answer serializers ───────────────────────────────
# Plain serializers (not model-bound — applications live in dynamic per-scheme
# tables). Field names match the dynamic model fields exactly, so validated_data
# can be splatted straight into Model.objects.create(**answers). The same dict is
# handed to EligibilityEngine (keys cgpa / current_level / trade_or_skill line up).

class ScholarshipAnswersSerializer(serializers.Serializer):
    institution_name = serializers.CharField(max_length=200)
    course_of_study  = serializers.CharField(max_length=200)
    current_level    = serializers.CharField(max_length=20)
    cgpa             = serializers.DecimalField(max_digits=4, decimal_places=2)
    admission_year   = serializers.IntegerField()
    matric_number    = serializers.CharField(max_length=50)


class EmpowermentAnswersSerializer(serializers.Serializer):
    trade_or_skill           = serializers.CharField(max_length=120)
    training_provider        = serializers.CharField(max_length=200, required=False,
                                                     allow_blank=True, default='')
    training_duration_months = serializers.IntegerField(required=False, allow_null=True)
    prior_experience         = serializers.CharField(required=False, allow_blank=True, default='')


class GrantAnswersSerializer(serializers.Serializer):
    business_name        = serializers.CharField(max_length=200)
    business_stage       = serializers.ChoiceField(
        choices=['idea', 'startup', 'growth', 'mature'])
    business_description = serializers.CharField()
    requested_amount     = serializers.DecimalField(max_digits=12, decimal_places=2)
    intended_use         = serializers.CharField()


# award_type → answers serializer for its programme_answers payload
PROGRAMME_ANSWER_SERIALIZERS = {
    'scholarship': ScholarshipAnswersSerializer,
    'empowerment': EmpowermentAnswersSerializer,
    'grant':       GrantAnswersSerializer,
}

# award_type → document keys (Cloudinary URLs) that must be present & non-blank.
REQUIRED_DOCUMENTS = {
    'scholarship': [
        ('admission_letter', 'admission letter'),
        ('last_result',      'latest result'),
    ],
}


# ── Read serialization of a dynamic application row ───────────────────────────
# Each row IS the full application (no separate detail table). These functions
# build plain dicts; DRF's JSON renderer handles Decimal/UUID/datetime values.

BANK_FIELDS = ['bank_name', 'bank_code', 'account_number', 'account_name', 'name_match_passed']


def _can_waive(row):
    return row.status == ApplicationStatus.DOUBLE_DIP_FLAG and not row.waiver_submitted


def _can_review(row):
    return row.status in REVIEWABLE_STATUSES


def _details_block(row):
    """The award-specific answers + bank snapshot for this application row."""
    from .dynamic import ANSWER_FIELDS
    fields = ANSWER_FIELDS.get(row.scheme.award_type, []) + BANK_FIELDS
    return {f: getattr(row, f, None) for f in fields}


def serialize_application(row):
    """Full detail shape for a single application row."""
    return {
        'id':              str(row.id),
        'student':         StudentNestedSerializer(row.student).data,
        'scheme':          SchemeNestedSerializer(row.scheme).data,
        'status':          row.status,
        'status_display':  row.get_status_display(),
        'submission_date': row.submission_date,
        # Programme-specific answers + bank snapshot
        'details':         _details_block(row),
        # Self-declaration
        'self_declaration_received_support': row.self_declaration_received_support,
        'self_declaration_details':          row.self_declaration_details,
        # Attestation
        'attestation_agreed': row.attestation_agreed,
        'attestation_at':     row.attestation_at,
        # Documents
        'documents': row.documents,
        # Eligibility
        'eligibility_passed':  row.eligibility_passed,
        'eligibility_details': row.eligibility_details,
        # Conflict
        'has_conflict':        row.has_conflict,
        'conflict_scheme_ids': row.conflict_scheme_ids,
        # Waiver
        'waiver_submitted': row.waiver_submitted,
        # Review
        'reviewer_notes':   row.reviewer_notes,
        'rejection_reason': row.rejection_reason,
        'reviewed_at':      row.reviewed_at,
        # Computed
        'can_waive':  _can_waive(row),
        'can_review': _can_review(row),
        'created_at': row.created_at,
        'updated_at': row.updated_at,
    }


def serialize_application_list(row):
    """Compact shape for list views (mine / flagged / admin list)."""
    return {
        'id':                 str(row.id),
        'student':            StudentNestedSerializer(row.student).data,
        'scheme':             SchemeNestedSerializer(row.scheme).data,
        'status':             row.status,
        'status_display':     row.get_status_display(),
        'submission_date':    row.submission_date,
        'eligibility_passed': row.eligibility_passed,
        'has_conflict':       row.has_conflict,
        'waiver_submitted':   row.waiver_submitted,
        'can_waive':          _can_waive(row),
        'created_at':         row.created_at,
    }


# ── Status history ────────────────────────────────────────────────────────────

class ApplicationStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.SerializerMethodField()

    class Meta:
        model  = ApplicationStatusHistory
        fields = ['id', 'application_id', 'from_status', 'to_status',
                  'reason', 'changed_by_email', 'changed_at']

    def get_changed_by_email(self, obj) -> str:
        return obj.changed_by.email if obj.changed_by else 'System'


# ── Submit serializer ─────────────────────────────────────────────────────────

class SelfDeclarationDetailSerializer(serializers.Serializer):
    """One row in the prior-support list."""
    organisation = serializers.CharField()
    category     = serializers.CharField()
    year         = serializers.IntegerField()


class ApplicationSubmitSerializer(serializers.Serializer):
    """
    POST /applications/submit/

    Fields:
      - scheme_id  (required)
      - programme_answers  (required — dict, validated per award_type on the view)
      - bank_* (resolved bank snapshot)
      - self_declaration_received_support  (required bool)
      - self_declaration_details  (required list if received_support=True)
      - attestation_agreed  (must be True)
      - documents  (optional dict of Cloudinary URLs)
    """
    scheme_id = serializers.UUIDField()

    programme_answers = serializers.DictField(
        child=serializers.JSONField(),
        required=True,
        allow_empty=False,
    )

    # Bank snapshot — collected fresh per application
    bank_account_number = serializers.CharField(max_length=10)
    bank_code           = serializers.CharField(max_length=10)
    bank_name           = serializers.CharField(max_length=100)
    bank_account_name   = serializers.CharField(max_length=200)
    bank_name_match_passed = serializers.BooleanField(default=False)

    # Self-declaration
    self_declaration_received_support = serializers.BooleanField()
    self_declaration_details          = serializers.ListField(
        child=SelfDeclarationDetailSerializer(),
        required=False,
        default=list,
    )

    # Attestation — MUST be True
    attestation_agreed = serializers.BooleanField()

    # Cloudinary document URLs (optional at submit; may be provided later)
    documents = serializers.DictField(
        child=serializers.CharField(allow_blank=True),
        required=False,
        default=dict,
    )

    def validate_attestation_agreed(self, value):
        if not value:
            raise serializers.ValidationError(
                "You must agree to the attestation to submit your application."
            )
        return value

    def validate(self, data):
        if data.get('self_declaration_received_support') is True:
            details = data.get('self_declaration_details', [])
            if not details:
                raise serializers.ValidationError({
                    'self_declaration_details': (
                        "You indicated you received prior support. "
                        "Please list each organisation, category, and year."
                    )
                })
        return data


# ── Review serializer ─────────────────────────────────────────────────────────

class ApplicationReviewSerializer(serializers.Serializer):
    DECISION_CHOICES = ['approved', 'rejected', 'shortlisted']

    decision = serializers.ChoiceField(choices=DECISION_CHOICES)
    notes    = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        if data.get('decision') == 'rejected' and not data.get('notes', '').strip():
            raise serializers.ValidationError(
                {'notes': 'A reason is required when rejecting an application.'}
            )
        return data
