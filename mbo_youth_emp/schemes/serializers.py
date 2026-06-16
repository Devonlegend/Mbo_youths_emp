from rest_framework import serializers
from .models import SchemeProvider, ScholarshipScheme, Cycle


class CycleSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Cycle
        fields = ['id', 'name', 'start_year', 'end_year', 'is_active']


class SchemeProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SchemeProvider
        fields = ['id', 'name', 'provider_type']


class ScholarshipSchemeSerializer(serializers.ModelSerializer):
    provider          = SchemeProviderSerializer(read_only=True)
    cycle             = CycleSerializer(read_only=True)
    cycle_id          = serializers.PrimaryKeyRelatedField(
                            queryset=Cycle.objects.all(),
                            source='cycle',
                            write_only=True,
                            required=False,
                            allow_null=True,
                        )
    award_type_display = serializers.CharField(source='get_award_type_display', read_only=True)

    class Meta:
        model  = ScholarshipScheme
        fields = [
            'id', 'provider', 'cycle', 'cycle_id', 'name', 'award_type', 'award_type_display',
            'description', 'academic_year', 'award_amount', 'total_slots', 'remaining_slots',
            'stacking_policy', 'eligibility_criteria', 'application_open_date',
            'application_close_date', 'is_active', 'is_published',
            'created_at', 'updated_at'
        ]

    def create(self, validated_data):
        # Find or create a default SchemeProvider to assign
        provider, _ = SchemeProvider.objects.get_or_create(
            name="Mbo LGA Council",
            defaults={"provider_type": "lga"}
        )
        validated_data['provider'] = provider

        # Set remaining slots to total slots initially
        validated_data['remaining_slots'] = validated_data['total_slots']

        # Process and build eligibility criteria from custom frontend inputs
        request = self.context.get('request')
        if request:
            min_cgpa           = request.data.get('min_cgpa')
            allowed_levels_raw = request.data.get('allowed_levels_raw')

            eligibility_criteria = {}
            if min_cgpa:
                try:
                    eligibility_criteria['min_cgpa'] = float(min_cgpa)
                except ValueError:
                    pass
            if allowed_levels_raw:
                levels = [x.strip() for x in allowed_levels_raw.split(',') if x.strip()]
                eligibility_criteria['allowed_levels'] = levels

            validated_data['eligibility_criteria'] = eligibility_criteria

        return super().create(validated_data)

    def update(self, instance, validated_data):
        # award_type is immutable: it determines the shape of this scheme's
        # dedicated application table, which is fixed at creation. SQLite cannot
        # cheaply ALTER the table to a different shape.
        new_award_type = validated_data.get('award_type')
        if new_award_type is not None and new_award_type != instance.award_type:
            raise serializers.ValidationError({
                'award_type': (
                    "award_type cannot be changed after a scheme is created "
                    "(its application table shape is fixed)."
                )
            })
        return super().update(instance, validated_data)
