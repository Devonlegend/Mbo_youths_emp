"""Serializers for the awards API.

Response shapes mirror the agreed frontend contract
(src/docs/Recurring_Scholarships_Frontend_Handoff.md §1): Award carries a brief
nested scheme + start_cycle, and the detail/mine endpoints include the full
installment timeline.
"""

from rest_framework import serializers

from .models import AppealStatus, Award, AwardAppeal, AwardInstallment, CgpaScale


def scheme_brief(scheme):
    if scheme is None:
        return None
    return {
        'id':         str(scheme.id),
        'name':       scheme.name,
        'award_type': scheme.award_type,
        'provider':   (
            {'id': str(scheme.provider_id), 'name': scheme.provider.name}
            if scheme.provider_id else None
        ),
    }


def cycle_brief(cycle):
    if cycle is None:
        return None
    return {'id': str(cycle.id), 'name': cycle.name}


class InstallmentSerializer(serializers.ModelSerializer):
    cycle             = serializers.SerializerMethodField()
    transcript        = serializers.SerializerMethodField()
    status_display    = serializers.CharField(source='get_status_display',
                                              read_only=True)
    is_open           = serializers.SerializerMethodField()

    class Meta:
        model = AwardInstallment
        fields = [
            'id', 'year_index', 'cycle', 'status', 'status_display', 'is_open',
            'amount', 'threshold',
            'submitted_cgpa', 'submitted_cgpa_scale', 'submitted_cgpa_normalized',
            'submitted_level', 'transcript',
            'verifier_note', 'verified_at', 'resubmission_count',
            'disbursed_at', 'disbursement_ref', 'created_at',
        ]

    def get_cycle(self, obj):
        return cycle_brief(obj.cycle)

    def get_transcript(self, obj):
        if not obj.transcript:
            return None
        try:
            return obj.transcript.url
        except Exception:
            return None

    def get_is_open(self, obj):
        from .models import InstallmentStatus
        return obj.status in (InstallmentStatus.PENDING_RENEWAL,
                              InstallmentStatus.PENDING_VERIFICATION)


class RenewalQueueSerializer(InstallmentSerializer):
    """An installment in the verifier queue, with the award/student context the
    queue table needs so it doesn't have to join client-side."""

    award = serializers.SerializerMethodField()

    class Meta(InstallmentSerializer.Meta):
        fields = InstallmentSerializer.Meta.fields + ['award']

    def get_award(self, obj):
        award = obj.award
        return {
            'id':              str(award.id),
            'status':          award.status,
            'total_years':     award.total_years,
            'current_year_index': award.current_year_index,
            'student': {
                'id':        str(award.student_id),
                'full_name': award.student.full_name,
                'email':     award.student.email,
                'ward':      award.student.ward,
            },
            'scheme': scheme_brief(award.scheme),
            'start_cycle': cycle_brief(award.start_cycle),
        }


class AwardListSerializer(serializers.ModelSerializer):
    scheme          = serializers.SerializerMethodField()
    start_cycle     = serializers.SerializerMethodField()
    status_display  = serializers.CharField(source='get_status_display',
                                            read_only=True)
    student         = serializers.SerializerMethodField()

    class Meta:
        model = Award
        fields = [
            'id', 'status', 'status_display', 'scheme', 'student',
            'annual_amount', 'total_years', 'current_year_index',
            'start_cycle', 'suspended_reason', 'suspended_at',
            'tenure_confidence', 'tenure_flags', 'created_at',
        ]

    def get_scheme(self, obj):
        return scheme_brief(obj.scheme)

    def get_start_cycle(self, obj):
        return cycle_brief(obj.start_cycle)

    def get_student(self, obj):
        return {
            'id':        str(obj.student_id),
            'full_name': obj.student.full_name,
            'email':     obj.student.email,
            'ward':      obj.student.ward,
        }


class AwardSerializer(AwardListSerializer):
    installments = InstallmentSerializer(many=True, read_only=True)
    pending_appeal = serializers.SerializerMethodField()

    class Meta(AwardListSerializer.Meta):
        fields = AwardListSerializer.Meta.fields + ['installments', 'pending_appeal']

    def get_pending_appeal(self, obj):
        for appeal in obj.appeals.all():
            if appeal.status == AppealStatus.PENDING:
                return AppealSerializer(appeal).data
        return None


class AppealSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    evidence       = serializers.SerializerMethodField()
    installment    = serializers.SerializerMethodField()
    award          = serializers.SerializerMethodField()
    reviewed_by    = serializers.SerializerMethodField()

    class Meta:
        model = AwardAppeal
        fields = [
            'id', 'status', 'status_display', 'reason', 'evidence',
            'installment', 'award', 'reviewed_by', 'reviewed_at',
            'review_note', 'created_at',
        ]

    def get_evidence(self, obj):
        if not obj.evidence:
            return None
        try:
            return obj.evidence.url
        except Exception:
            return None

    def get_installment(self, obj):
        inst = obj.installment
        return {
            'id':         str(inst.id),
            'year_index': inst.year_index,
            'status':     inst.status,
        }

    def get_reviewed_by(self, obj):
        if not obj.reviewed_by_id:
            return None
        return {'id': str(obj.reviewed_by_id), 'full_name': obj.reviewed_by.full_name}

    def get_award(self, obj):
        award = obj.award
        return {
            'id':              str(award.id),
            'status':          award.status,
            'total_years':     award.total_years,
            'current_year_index': award.current_year_index,
            'student': {
                'id':        str(award.student_id),
                'full_name': award.student.full_name,
                'email':     award.student.email,
                'ward':      award.student.ward,
            },
            'scheme': scheme_brief(award.scheme),
        }


# ── Request serializers ────────────────────────────────────────────────────

class RenewalSubmitSerializer(serializers.Serializer):
    cgpa       = serializers.DecimalField(max_digits=4, decimal_places=2)
    cgpa_scale = serializers.ChoiceField(choices=CgpaScale.choices,
                                         required=False, default=CgpaScale.FIVE)
    level      = serializers.CharField(max_length=20, required=False,
                                       allow_blank=True, default='')
    transcript = serializers.FileField(required=False, allow_null=True)


class VerifyInstallmentSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject', 'withhold'])
    note   = serializers.CharField(required=False, allow_blank=True, default='')


class DisburseSerializer(serializers.Serializer):
    disbursement_ref = serializers.CharField(max_length=120, required=False,
                                             allow_blank=True, default='')


class AwardActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class AppealSubmitSerializer(serializers.Serializer):
    reason   = serializers.CharField()
    evidence = serializers.FileField(required=False, allow_null=True)


class AppealReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['upheld', 'rejected'])
    note     = serializers.CharField(required=False, allow_blank=True, default='')
