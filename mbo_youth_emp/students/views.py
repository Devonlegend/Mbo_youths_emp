from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse, inline_serializer

import logging
logger = logging.getLogger(__name__)

from .models import Student, AcademicRecord
from .serializers import StudentSerializer, StudentCreateSerializer, AcademicRecordSerializer
from accounts.permissions import IsAdmin, IsStudent, IsVerifier

from django.utils import timezone
from rest_framework import serializers as drf_serializers

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
            Verifiers and admins can list everyone; only admins can delete.
            Only admins can approve/reject verification.
            """
            if self.action == 'list':
                return [IsVerifier()]
            if self.action == 'destroy':
                return [IsAdmin()]
            if self.action in ('verify', 'pending'):
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
        for student in Student.objects.values('ward').annotate(count=Count('user_id')):
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
        student = getattr(user, 'student', None)
        if student is None:
            return Response({"error": "No student profile found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(student)
        return Response(serializer.data)
        
    @action(detail=False, methods=['get'], url_path='bank')
    def bank(self, request):
        """GET /students/bank/ — current user's saved bank details."""
        student = getattr(request.user, 'student', None)
        if student is None:
            return Response({"error": "No student profile found"}, status=404)
        return Response({
            "bank_name": student.bank_name,
            "bank_code": student.bank_code,
            "account_number": student.bank_account_number,
            "account_name": student.bank_account_name,
        })

    @bank.mapping.patch
    def update_bank(self, request):
        """PATCH /students/bank/ — save/update bank details."""
        student = getattr(request.user, 'student', None)
        if student is None:
            return Response({"error": "No student profile found"}, status=404)
        student.bank_name = request.data.get('bank_name', student.bank_name)
        student.bank_code = request.data.get('bank_code', student.bank_code)
        student.bank_account_number = request.data.get('account_number', student.bank_account_number)
        student.bank_account_name = request.data.get('account_name', student.bank_account_name)
        student.save()
        return Response({
            "bank_name": student.bank_name,
            "bank_code": student.bank_code,
            "account_number": student.bank_account_number,
            "account_name": student.bank_account_name,
        })
    
    @extend_schema(
        summary="Approve or reject a student's verification",
        request=inline_serializer(
            name='StudentVerifyRequest',
            fields={
                'decision': drf_serializers.ChoiceField(choices=['approved', 'rejected']),
                'notes': drf_serializers.CharField(required=False, allow_blank=True, default=''),
            },
        ),
        responses=OpenApiResponse(description='{ id, is_verified, verification_rejection_reason }'),
    )
    @action(detail=True, methods=['patch'], url_path='verify')
    def verify(self, request, pk=None):
        """PATCH /students/{id}/verify/  Body: { decision, notes? }"""
        student = self.get_object()
        decision = request.data.get('decision')
        notes = (request.data.get('notes') or '').strip()

        if decision not in ('approved', 'rejected'):
            return Response({"error": "decision must be 'approved' or 'rejected'"},
                             status=status.HTTP_400_BAD_REQUEST)
        if decision == 'rejected' and not notes:
            return Response({"error": "notes is required when rejecting"},
                             status=status.HTTP_400_BAD_REQUEST)

        student.verification_reviewed_at = timezone.now()

        if decision == 'approved':
            student.is_verified = True
            student.verification_rejection_reason = ''
        else:
            student.is_verified = False
            student.verification_rejection_reason = notes

        student.save(update_fields=[
            'is_verified', 'verification_rejection_reason', 'verification_reviewed_at'
        ])

        from notifications.models import Notification
        from accounts.services import send_verification_decision_email

        if decision == 'approved':
            title, message = (
                'Account Verified',
                'Your account has been verified. You can now apply for available programmes.',
            )
        else:
            title, message = (
                'Verification Update Required',
                f'Your account verification was not approved. Reason: {notes}',
            )

        Notification.objects.create(
            user=student.user,
            type='verification_approved' if decision == 'approved' else 'verification_rejected',
            title=title,
            message=message,
        )

        try:
            send_verification_decision_email(student.user.email, decision, notes)
        except Exception:
            logger.exception("Failed to send verification decision email to %s", student.user.email)
            # Decision is already saved — don't fail the request over an email hiccup.

        return Response({
            "id": str(student.pk),
            "is_verified": student.is_verified,
            "verification_rejection_reason": student.verification_rejection_reason,
        })

    @extend_schema(
        summary="List students pending verification",
        responses=OpenApiResponse(description='{ count, next, previous, results: [...] }'),
    )
    @action(detail=False, methods=['get'], url_path='pending')
    def pending(self, request):
        """GET /students/pending/"""
        queryset = Student.objects.filter(is_verified=False).order_by('firstname')
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)