from rest_framework import serializers
from .models import ScholarshipScheme


class ScholarshipSchemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScholarshipScheme
        fields = [
            'id', 'provider', 'name', 'award_type', 'description',
            'academic_year', 'award_amount', 'total_slots', 'remaining_slots',
            'stacking_policy', 'eligibility_criteria', 'application_open_date',
            'application_close_date', 'is_active', 'is_published',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']
