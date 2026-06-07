from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Student, AcademicRecord
from .serializers import StudentSerializer, StudentCreateSerializer, AcademicRecordSerializer
from accounts.permissions import IsAdmin, IsStudent, IsVerifier


class StudentViewSet(viewsets.ModelViewSet):
    queryset           = Student.objects.all().order_by('firstname')
    serializer_class   = StudentSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return StudentCreateSerializer
        return StudentSerializer

    def get_permissions(self):
        if self.action in ['list', 'destroy']:
            return [IsAdmin()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get', 'post'], url_path='bank-detail')
    def bank_detail(self, request):
        student = getattr(request.user, 'student_profile', None)
        if student is None:
            return Response({"error": "No student profile found"}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'GET':
            return Response({
                "bank_name":      student.bank_name      or "",
                "account_number": student.account_number or "",
                "account_name":   student.account_name   or "",
            })

        student.bank_name      = request.data.get('bank_name', '')
        student.account_number = request.data.get('account_number', '')
        student.account_name   = request.data.get('account_name', '')
        student.save(update_fields=['bank_name', 'account_number', 'account_name'])
        return Response({
            "bank_name":      student.bank_name,
            "account_number": student.account_number,
            "account_name":   student.account_name,
        })
    
    

    @action(detail=True, methods=['get'], url_path='eligibility-check')
    def eligibility_check(self, request, pk=None):
        student = self.get_object()
        try:
            min_cgpa       = float(request.query_params.get('min_cgpa', 2.20))
            required_level = request.query_params.get('level', '')
        except ValueError:
            return Response({"error": "Invalid parameters"}, status=400)

        student_cgpa = float(student.cgpa) if student.cgpa else 0.0
        cgpa_ok      = student_cgpa >= min_cgpa
        level_ok     = (str(student.level) == str(required_level)) if required_level else True
        conflict     = student.has_active_award()

        return Response({
            "student":  student.full_name,
            "eligible": cgpa_ok and level_ok and not conflict,
            "checks": {
                "cgpa":     {"passed": cgpa_ok,  "value": student_cgpa, "required": min_cgpa},
                "level":    {"passed": level_ok, "value": student.level, "required": required_level},
                "conflict": {"has_conflict": conflict, "active_award": student.active_award},
            }
        })

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        from django.db.models import Count

        total      = Student.objects.count()
        verified   = Student.objects.filter(is_verified=True).count()
        with_award = Student.objects.exclude(active_award='').count()

        by_ward = {}
        for student in Student.objects.values('ward').annotate(count=Count('id')):
            by_ward[student['ward']] = student['count']

        return Response({
            "total_students":    total,
            "verified":          verified,
            "unverified":        total - verified,
            "with_active_award": with_award,
            "by_ward":           by_ward,
        })

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        student = getattr(request.user, 'student_profile', None)
        if student is None:
            return Response({"error": "No student profile found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(student)
        return Response(serializer.data)
    
@action(detail=True, methods=['post'], url_path='verify')
def verify(self, request, pk=None):
    student = self.get_object()
    student.is_verified = not student.is_verified
    student.save(update_fields=['is_verified'])

    from notifications.models import Notification
    if student.is_verified:
        Notification.objects.create(
            user    = student.user,
            type    = 'alert',
            title   = 'Account verified',
            message = 'Your account has been verified by an admin. You can now apply for available schemes.',
        )

    return Response({'is_verified': student.is_verified})