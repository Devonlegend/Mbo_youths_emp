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

    class Meta:
        model  = Student
        fields = [
            'firstname', 'lastname', 'ward', 'lga', 'level', 'cgpa',
            'is_verified',
            'active_award', 'has_active_award', 'academic_records',
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