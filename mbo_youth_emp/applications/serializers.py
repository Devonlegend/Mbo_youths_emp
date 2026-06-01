"""Serializers for per-award-type submission details.

Each serializer validates the `details` payload posted to /applications/submit/.
The view picks one based on the scheme's `award_type`, validates BEFORE creating
the Application row, then persists the detail row tied to the new Application.
"""
from rest_framework import serializers

from .models import ScholarshipDetails, EmpowermentDetails, GrantDetails


_BANK_FIELDS = ('bank_name', 'account_number', 'account_name')


class ScholarshipDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ScholarshipDetails
        fields = (
            'institution_name', 'course_of_study', 'current_level',
            'cgpa', 'admission_year', 'matric_number',
        ) + _BANK_FIELDS


class EmpowermentDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmpowermentDetails
        fields = (
            'trade_or_skill', 'training_provider',
            'training_duration_months', 'prior_experience',
        ) + _BANK_FIELDS


class GrantDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GrantDetails
        fields = (
            'business_name', 'business_stage', 'business_description',
            'requested_amount', 'intended_use',
        ) + _BANK_FIELDS


# Maps scheme.award_type -> the serializer that validates the `details` payload.
DETAILS_SERIALIZER_BY_TYPE = {
    'scholarship': ScholarshipDetailsSerializer,
    'empowerment': EmpowermentDetailsSerializer,
    'grant':       GrantDetailsSerializer,
}
