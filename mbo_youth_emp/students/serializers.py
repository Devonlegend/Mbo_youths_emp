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

    email        = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    gender       = serializers.SerializerMethodField()

    passport    = serializers.FileField(use_url=True, read_only=True)
    certificate = serializers.FileField(use_url=True, read_only=True)

    class Meta:
        model  = Student
        fields = [
            'user_id', 'firstname', 'lastname', 'ward', 'lga', 'level', 'cgpa',
            'is_verified', 'active_award', 'has_active_award', 'academic_records',
            'date_of_birth', 'passport', 'certificate', 'nin_hash',
            'email', 'phone_number', 'gender',
        ]

    def get_has_active_award(self, obj):
        return obj.has_active_award()

    def get_email(self, obj):
        return getattr(obj.user, 'email', None)

    def get_phone_number(self, obj):
        return getattr(obj.user, 'phone_number', None)

    def get_gender(self, obj):
        return getattr(obj.user, 'gender', None)


class StudentCreateSerializer(serializers.ModelSerializer):
    """Used only when creating a new student profile."""
    class Meta:
        model  = Student
        fields = [
            'firstname', 'lastname', 'ward', 'lga', 'level', 'cgpa',
            'nin_hash', 'active_award',
        ]