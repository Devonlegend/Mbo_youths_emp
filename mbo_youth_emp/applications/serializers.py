"""Serializers for per-award-type submission details."""
from datetime import datetime

from rest_framework import serializers

from .models import Application, ScholarshipDetails, EmpowermentDetails, GrantDetails
from accounts.models import User
from students.models import Student


_BANK_FIELDS = ('bank_name', 'account_number', 'account_name')


class StudentNestedSerializer(serializers.ModelSerializer):
    email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Student
        fields = ('user_id', 'firstname', 'lastname', 'email', 'lga', 'ward', 'is_verified')


class ApplicationSerializer(serializers.ModelSerializer):
    student         = StudentNestedSerializer(read_only=True)
    scheme_category = serializers.CharField(source='scheme.award_type', read_only=True)
    scheme_name     = serializers.CharField(source='scheme.name',       read_only=True)
    award_type      = serializers.CharField(source='scheme.award_type', read_only=True)
    form_data       = serializers.SerializerMethodField()

    class Meta:
        model  = Application
        fields = (
            'id', 'student', 'scheme', 'scheme_name', 'scheme_category',
            'award_type', 'status', 'submission_date', 'eligibility_passed',
            'eligibility_details', 'has_conflict', 'conflict_scheme_ids',
            'waiver_submitted', 'reviewed_by', 'reviewed_at', 'reviewer_notes',
            'rejection_reason', 'created_at', 'updated_at',
            'form_data',
        )

    def get_form_data(self, obj):
        award_type = obj.scheme.award_type

        if award_type in ('empowerment', 'vocational'):
            detail = getattr(obj, 'empowerment_details', None)
            if not detail:
                return {}
            return {
                'training_name':    detail.trade_or_skill,
                'education_level':  detail.training_provider,
                'prior_experience': detail.prior_experience,
                'trade':            detail.trade_or_skill,
                'current_status':   detail.training_provider,
                'bank_name':        detail.bank_name,
                'account_number':   detail.account_number,
                'account_name':     detail.account_name,
            }

        if award_type == 'scholarship':
            detail = getattr(obj, 'scholarship_details', None)
            if not detail:
                return {}
            return {
                'institution':    detail.institution_name,
                'department':     detail.course_of_study,
                'current_level':  detail.current_level,
                'cgpa':           str(detail.cgpa) if detail.cgpa else '—',
                'matric_number':  detail.matric_number,
                'bank_name':      detail.bank_name,
                'account_number': detail.account_number,
                'account_name':   detail.account_name,
            }

        if award_type == 'grant':
            detail = getattr(obj, 'grant_details', None)
            if not detail:
                return {}
            return {
                'grant_purpose':          detail.business_name,
                'business_plan_desc':     detail.business_description,
                'amount_requested':       str(detail.requested_amount) if detail.requested_amount else '—',
                'expected_beneficiaries': detail.intended_use,
                'bank_name':              detail.bank_name,
                'account_number':         detail.account_number,
                'account_name':           detail.account_name,
            }

        return {}


def normalize_details_payload(award_type, payload):
    """Accept both the new `details` contract and the legacy flat form payload."""
    if not isinstance(payload, dict):
        return payload

    if isinstance(payload.get('details'), dict):
        normalized = dict(payload['details'])
    else:
        normalized = dict(payload)

    for key in ('scheme_id', 'details', 'category', 'result_document', 'admission_letter', 'business_plan'):
        normalized.pop(key, None)

    if award_type == 'scholarship':
        normalized.setdefault('institution_name', normalized.pop('institution', None) or normalized.get('institution_name'))
        normalized.setdefault('course_of_study', normalized.pop('department', None) or normalized.get('course_of_study'))
        normalized.setdefault('current_level', normalized.get('current_level'))
        normalized.setdefault('cgpa', normalized.get('cgpa'))
        normalized.setdefault('matric_number', normalized.get('matric_number'))
        normalized.setdefault('admission_year', normalized.get('admission_year') or datetime.now().year)
        normalized.setdefault('bank_name', normalized.get('bank_name', ''))
        normalized.setdefault('account_number', normalized.get('account_number', ''))
        normalized.setdefault('account_name', normalized.get('account_name', ''))

    elif award_type == 'empowerment':
        normalized.setdefault('trade_or_skill', normalized.pop('training_name', None) or normalized.get('trade_or_skill'))
        normalized.setdefault('training_provider', normalized.get('training_provider') or normalized.get('education_level') or '')
        normalized.setdefault('training_duration_months', normalized.get('training_duration_months'))
        normalized.setdefault('prior_experience', normalized.get('prior_experience', ''))
        normalized.setdefault('bank_name', normalized.get('bank_name', ''))
        normalized.setdefault('account_number', normalized.get('account_number', ''))
        normalized.setdefault('account_name', normalized.get('account_name', ''))

    elif award_type == 'grant':
        normalized.setdefault('business_name', normalized.pop('grant_purpose', None) or normalized.get('business_name'))
        normalized.setdefault('business_stage', normalized.get('business_stage', 'idea'))
        normalized.setdefault('business_description', normalized.pop('business_plan_desc', None) or normalized.get('business_description', ''))
        normalized.setdefault('requested_amount', normalized.pop('amount_requested', None) or normalized.get('requested_amount'))
        normalized.setdefault('intended_use', normalized.pop('expected_beneficiaries', None) or normalized.get('intended_use', ''))
        normalized.setdefault('bank_name', normalized.get('bank_name', ''))
        normalized.setdefault('account_number', normalized.get('account_number', ''))
        normalized.setdefault('account_name', normalized.get('account_name', ''))

    return normalized


class ScholarshipDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ScholarshipDetails
        fields = (
            'institution_name', 'course_of_study', 'current_level',
            'cgpa', 'admission_year', 'matric_number',
        ) + _BANK_FIELDS
        extra_kwargs = {
            'bank_name':      {'required': False, 'allow_blank': True},
            'account_number': {'required': False, 'allow_blank': True},
            'account_name':   {'required': False, 'allow_blank': True},
        }


class EmpowermentDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmpowermentDetails
        fields = (
            'trade_or_skill', 'training_provider',
            'training_duration_months', 'prior_experience',
        ) + _BANK_FIELDS
        extra_kwargs = {
            'bank_name':      {'required': False, 'allow_blank': True},
            'account_number': {'required': False, 'allow_blank': True},
            'account_name':   {'required': False, 'allow_blank': True},
        }


class GrantDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GrantDetails
        fields = (
            'business_name', 'business_stage', 'business_description',
            'requested_amount', 'intended_use',
        ) + _BANK_FIELDS
        extra_kwargs = {
            'bank_name':      {'required': False, 'allow_blank': True},
            'account_number': {'required': False, 'allow_blank': True},
            'account_name':   {'required': False, 'allow_blank': True},
        }


DETAILS_SERIALIZER_BY_TYPE = {
    'scholarship': ScholarshipDetailsSerializer,
    'empowerment': EmpowermentDetailsSerializer,
    'grant':       GrantDetailsSerializer,
}