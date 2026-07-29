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
    provider_id       = serializers.PrimaryKeyRelatedField(
                            queryset=SchemeProvider.objects.all(),
                            source='provider',
                            write_only=True,
                            required=False,
                            allow_null=True,
                        )
    award_type_display = serializers.CharField(source='get_award_type_display', read_only=True)

    class Meta:
        model  = ScholarshipScheme
        fields = [
            'id', 'provider', 'cycle', 'cycle_id', 'provider_id', 'name', 'award_type',
            'award_type_display', 'description', 'academic_year', 'award_amount',
            'total_slots', 'remaining_slots', 'stacking_policy', 'eligibility_criteria',
            'application_open_date', 'application_close_date', 'is_active', 'is_published',
            'created_at', 'updated_at'
        ]

    def create(self, validated_data):
        # Assign provider — use the specified one or fall back to default
        if 'provider' not in validated_data or validated_data.get('provider') is None:
            provider, _ = SchemeProvider.objects.get_or_create(
                name="Mbo LGA Council",
                defaults={"provider_type": "lga"}
            )
            validated_data['provider'] = provider

        validated_data['remaining_slots'] = validated_data['total_slots']

        award_type = validated_data.get('award_type', 'scholarship')
        request = self.context.get('request')

        eligibility_criteria = {}
        if request:
            if award_type == 'scholarship':
                min_cgpa = request.data.get('min_cgpa')
                allowed_levels = request.data.get('allowed_levels')
                ward_restriction = request.data.get('ward_restriction')
                max_prior_awards = request.data.get('max_prior_awards')
                if min_cgpa:
                    try:
                        eligibility_criteria['min_cgpa'] = float(min_cgpa)
                    except ValueError:
                        pass
                if allowed_levels:
                    if isinstance(allowed_levels, str):
                        eligibility_criteria['allowed_levels'] = [
                            x.strip() for x in allowed_levels.split(',') if x.strip()
                        ]
                    elif isinstance(allowed_levels, list):
                        eligibility_criteria['allowed_levels'] = allowed_levels
                if ward_restriction is not None and ward_restriction != '':
                    if isinstance(ward_restriction, str):
                        eligibility_criteria['ward_restriction'] = [
                            x.strip() for x in ward_restriction.split(',') if x.strip()
                        ]
                    elif isinstance(ward_restriction, list):
                        eligibility_criteria['ward_restriction'] = ward_restriction
                if max_prior_awards is not None and max_prior_awards != '':
                    try:
                        eligibility_criteria['max_prior_awards'] = int(max_prior_awards)
                    except ValueError:
                        pass

            elif award_type == 'empowerment':
                min_age = request.data.get('min_age')
                max_age = request.data.get('max_age')
                allowed_trades = request.data.get('allowed_trades')
                ward_restriction = request.data.get('ward_restriction')
                max_prior_awards = request.data.get('max_prior_awards')
                if min_age:
                    try:
                        eligibility_criteria['min_age'] = int(min_age)
                    except ValueError:
                        pass
                if max_age:
                    try:
                        eligibility_criteria['max_age'] = int(max_age)
                    except ValueError:
                        pass
                if allowed_trades:
                    if isinstance(allowed_trades, str):
                        eligibility_criteria['allowed_trades'] = [
                            x.strip() for x in allowed_trades.split(',') if x.strip()
                        ]
                    elif isinstance(allowed_trades, list):
                        eligibility_criteria['allowed_trades'] = allowed_trades
                if ward_restriction is not None and ward_restriction != '':
                    if isinstance(ward_restriction, str):
                        eligibility_criteria['ward_restriction'] = [
                            x.strip() for x in ward_restriction.split(',') if x.strip()
                        ]
                    elif isinstance(ward_restriction, list):
                        eligibility_criteria['ward_restriction'] = ward_restriction
                if max_prior_awards is not None and max_prior_awards != '':
                    try:
                        eligibility_criteria['max_prior_awards'] = int(max_prior_awards)
                    except ValueError:
                        pass

            elif award_type == 'grant':
                min_age = request.data.get('min_age')
                max_age = request.data.get('max_age')
                ward_restriction = request.data.get('ward_restriction')
                max_prior_awards = request.data.get('max_prior_awards')
                if min_age:
                    try:
                        eligibility_criteria['min_age'] = int(min_age)
                    except ValueError:
                        pass
                if max_age:
                    try:
                        eligibility_criteria['max_age'] = int(max_age)
                    except ValueError:
                        pass
                if ward_restriction is not None and ward_restriction != '':
                    if isinstance(ward_restriction, str):
                        eligibility_criteria['ward_restriction'] = [
                            x.strip() for x in ward_restriction.split(',') if x.strip()
                        ]
                    elif isinstance(ward_restriction, list):
                        eligibility_criteria['ward_restriction'] = ward_restriction
                if max_prior_awards is not None and max_prior_awards != '':
                    try:
                        eligibility_criteria['max_prior_awards'] = int(max_prior_awards)
                    except ValueError:
                        pass

            validated_data['eligibility_criteria'] = eligibility_criteria

        return super().create(validated_data)

    def update(self, instance, validated_data):
        new_award_type = validated_data.get('award_type')
        if new_award_type is not None and new_award_type != instance.award_type:
            raise serializers.ValidationError({
                'award_type': (
                    "award_type cannot be changed after a scheme is created "
                    "(its application table shape is fixed)."
                )
            })

        award_type = instance.award_type
        request = self.context.get('request')

        eligibility_criteria = {}
        if request and any(k in request.data for k in [
            'min_cgpa', 'allowed_levels', 'min_age', 'max_age',
            'allowed_trades', 'ward_restriction', 'max_prior_awards'
        ]):
            if award_type == 'scholarship':
                min_cgpa = request.data.get('min_cgpa')
                allowed_levels = request.data.get('allowed_levels')
                ward_restriction = request.data.get('ward_restriction')
                max_prior_awards = request.data.get('max_prior_awards')
                if min_cgpa is not None:
                    try:
                        eligibility_criteria['min_cgpa'] = float(min_cgpa)
                    except ValueError:
                        pass
                else:
                    existing = instance.eligibility_criteria or {}
                    if 'min_cgpa' in existing:
                        eligibility_criteria['min_cgpa'] = existing['min_cgpa']
                if allowed_levels is not None:
                    if isinstance(allowed_levels, str):
                        eligibility_criteria['allowed_levels'] = [
                            x.strip() for x in allowed_levels.split(',') if x.strip()
                        ]
                    elif isinstance(allowed_levels, list):
                        eligibility_criteria['allowed_levels'] = allowed_levels
                else:
                    existing = instance.eligibility_criteria or {}
                    if 'allowed_levels' in existing:
                        eligibility_criteria['allowed_levels'] = existing['allowed_levels']
                if ward_restriction is not None:
                    if ward_restriction == '':
                        eligibility_criteria['ward_restriction'] = None
                    else:
                        if isinstance(ward_restriction, str):
                            eligibility_criteria['ward_restriction'] = [
                                x.strip() for x in ward_restriction.split(',') if x.strip()
                            ]
                        elif isinstance(ward_restriction, list):
                            eligibility_criteria['ward_restriction'] = ward_restriction
                if max_prior_awards is not None:
                    try:
                        eligibility_criteria['max_prior_awards'] = int(max_prior_awards)
                    except ValueError:
                        pass

            elif award_type in ('empowerment', 'grant'):
                min_age = request.data.get('min_age')
                max_age = request.data.get('max_age')
                ward_restriction = request.data.get('ward_restriction')
                max_prior_awards = request.data.get('max_prior_awards')
                if min_age is not None:
                    try:
                        eligibility_criteria['min_age'] = int(min_age)
                    except ValueError:
                        pass
                if max_age is not None:
                    try:
                        eligibility_criteria['max_age'] = int(max_age)
                    except ValueError:
                        pass
                if ward_restriction is not None:
                    if ward_restriction == '':
                        eligibility_criteria['ward_restriction'] = None
                    else:
                        if isinstance(ward_restriction, str):
                            eligibility_criteria['ward_restriction'] = [
                                x.strip() for x in ward_restriction.split(',') if x.strip()
                            ]
                        elif isinstance(ward_restriction, list):
                            eligibility_criteria['ward_restriction'] = ward_restriction
                if max_prior_awards is not None:
                    try:
                        eligibility_criteria['max_prior_awards'] = int(max_prior_awards)
                    except ValueError:
                        pass

                if award_type == 'empowerment':
                    allowed_trades = request.data.get('allowed_trades')
                    if allowed_trades is not None:
                        if isinstance(allowed_trades, str):
                            eligibility_criteria['allowed_trades'] = [
                                x.strip() for x in allowed_trades.split(',') if x.strip()
                            ]
                        elif isinstance(allowed_trades, list):
                            eligibility_criteria['allowed_trades'] = allowed_trades

            if eligibility_criteria:
                validated_data['eligibility_criteria'] = eligibility_criteria

        return super().update(instance, validated_data)
