from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

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
        """
        Different actions need different permissions.
        Students can only see their own profile.
        Admins can see everyone.
        """
        if self.action in ['list', 'destroy']:
            return [IsAdmin()]
        return [IsAuthenticated()]

    @extend_schema(
        summary="Quick eligibility pre-check",
        description=(
            "Label-based pre-check using the student's active_award flag. The "
            "authoritative check runs at submit time via the EligibilityEngine."
        ),
        parameters=[
            OpenApiParameter('min_cgpa', float, description='Default 2.20.'),
            OpenApiParameter('level', str, description='Required level (optional).'),
        ],
        responses=OpenApiResponse(description='{ student, eligible, checks: {cgpa, level, conflict} }'),
    )
    @action(detail=True, methods=['get'], url_path='eligibility-check')
    def eligibility_check(self, request, pk=None):
        # Simplified, label-based pre-check (uses the student's active_award flag).
        # The authoritative conflict evaluation happens at submit time via
        # EligibilityEngine, which inspects approved Application rows.
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

    @extend_schema(
        summary="Student statistics",
        description='Aggregate counts: totals, verified, active awards, and a by-ward breakdown.',
        responses=OpenApiResponse(description='{ total_students, verified, unverified, with_active_award, by_ward }'),
    )
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """GET /students/stats/"""
        from django.db.models import Count

        total        = Student.objects.count()
        verified     = Student.objects.filter(is_verified=True).count()
        with_award   = Student.objects.exclude(active_award='').count()

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

    @extend_schema(
        summary="My student profile",
        description="The current user's student profile.",
        responses=StudentSerializer,
    )
    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        """GET /students/me/ — return current user's student profile."""
        user = request.user
        student = getattr(user, 'student_profile', None)
        if student is None:
            return Response({"error": "No student profile found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(student)
        return Response(serializer.data)