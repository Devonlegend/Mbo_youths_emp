from rest_framework import serializers
from .models import ScholarshipScheme, SchemeFormField


class SchemeFormFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchemeFormField
        fields = (
            'id', 'field_name', 'field_label', 'field_type',
            'placeholder', 'is_required', 'options', 'order', 'section',
        )


class ScholarshipSchemeSerializer(serializers.ModelSerializer):
    form_fields = SchemeFormFieldSerializer(many=True, read_only=True)

    class Meta:
        model = ScholarshipScheme
        fields = [
            'id', 'provider', 'name', 'award_type', 'description',
            'academic_year', 'award_amount', 'total_slots', 'remaining_slots',
            'stacking_policy', 'eligibility_criteria', 'application_open_date',
            'application_close_date', 'is_active', 'is_published',
            'form_fields', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'provider', 'remaining_slots']
        extra_kwargs = {
            'eligibility_criteria': {'required': False},
        }