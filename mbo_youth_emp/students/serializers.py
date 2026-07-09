from rest_framework import serializers
from .models import Student, AcademicRecord



class AcademicRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AcademicRecord
        fields = [
            'id', 'institution_name', 'course_of_study',
            'current_level', 'cgpa', 'admission_year',
        ]


class StudentSerializer(serializers.ModelSerializer):
    academic_records = AcademicRecordSerializer(many=True, read_only=True)
    has_active_award = serializers.SerializerMethodField()
    user_id           = serializers.UUIDField(source='user.id', read_only=True)
    email             = serializers.EmailField(source='user.email', read_only=True)
    phone_number      = serializers.CharField(source='user.phone_number', read_only=True)
    gender            = serializers.CharField(source='user.gender', read_only=True)

    class Meta:
        model  = Student
        fields = [
            'user_id', 'firstname', 'lastname', 'email', 'phone_number', 'gender',
            'ward', 'lga', 'level', 'cgpa',
            'is_verified', 'verification_rejection_reason', 'verification_reviewed_at',
            'active_award', 'has_active_award', 'academic_records',
            'passport', 'certificate',
        ]

    def get_has_active_award(self, obj) -> bool:
        return obj.has_active_award()

class StudentCreateSerializer(serializers.ModelSerializer):
    """Used only when creating a new student profile."""
    class Meta:
        model  = Student
        fields = [
            'firstname', 'lastname', 'ward', 'lga', 'level', 'cgpa',
            'nin_hash', 'active_award',
        ]