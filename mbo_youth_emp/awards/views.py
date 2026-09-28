"""Awards API — student renewals and the staff verification/disbursement flow.

Mounted at /awards/ (see awards/urls.py). Object-level ownership checks live
here; every state transition lives in awards/services/lifecycle.py.
"""

import csv

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from accounts.permissions import IsAdmin, IsVerifier
from schemes.models import Cycle

from .models import Award, AwardInstallment, InstallmentStatus
from .serializers import (
    AwardActionSerializer,
    AwardListSerializer,
    AwardSerializer,
    DisburseSerializer,
    InstallmentSerializer,
    RenewalQueueSerializer,
    RenewalSubmitSerializer,
    VerifyInstallmentSerializer,
)
from .services.lifecycle import (
    LifecycleError,
    disburse_installment,
    submit_renewal,
    suspend_award,
    terminate_award,
    verify_installment,
)


def _is_staff(user):
    return getattr(user, 'role', None) in ('verifier', 'admin', 'superadmin')


def _award_queryset():
    return (
        Award.objects
        .select_related('scheme__provider', 'start_cycle', 'student')
        .prefetch_related('installments__cycle')
        .order_by('-created_at')
    )


class AwardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination

    def get_permissions(self):
        if self.action in ('list', 'renewals', 'export'):
            return [IsVerifier()]
        if self.action in ('suspend', 'terminate'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def _paginate(self, request, queryset, serializer_class):
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        if page is not None:
            return paginator.get_paginated_response(
                serializer_class(page, many=True).data)
        return Response(serializer_class(queryset, many=True).data)

    # ── Staff register ─────────────────────────────────────────────────────
    @extend_schema(
        summary="Awards register",
        description=("Paginated multi-year award register. Verifier/admin only. "
                     "Filters: status, scheme, cycle, programme_type, search."),
        parameters=[
            OpenApiParameter('status', str),
            OpenApiParameter('scheme', str),
            OpenApiParameter('cycle', str, description="Cycle id, or 'active'."),
            OpenApiParameter('programme_type', str),
            OpenApiParameter('search', str, description='Student name search.'),
        ],
        responses=OpenApiResponse(description='Paginated award list.'),
    )
    def list(self, request):
        qs = _award_queryset()

        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        scheme_param = request.query_params.get('scheme')
        if scheme_param:
            qs = qs.filter(scheme_id=scheme_param)

        cycle_param = request.query_params.get('cycle')
        if cycle_param == 'active':
            active = Cycle.get_active()
            qs = qs.filter(start_cycle=active) if active else qs.none()
        elif cycle_param:
            qs = qs.filter(start_cycle_id=cycle_param)

        programme_type = request.query_params.get('programme_type')
        if programme_type:
            qs = qs.filter(student__programme_type=programme_type)

        search = (request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(student__firstname__icontains=search)
                | Q(student__lastname__icontains=search)
                | Q(student__email__icontains=search)
            )

        return self._paginate(request, qs, AwardListSerializer)

    # ── Detail ─────────────────────────────────────────────────────────────
    @extend_schema(
        summary="Award detail",
        description="One award + full installment timeline. Owner or staff only.",
        responses=AwardSerializer,
    )
    def retrieve(self, request, pk=None):
        award = get_object_or_404(_award_queryset(), pk=pk)
        if not (_is_staff(request.user) or award.student_id == request.user.pk):
            return Response({'error': 'Award not found'}, status=404)
        return Response(AwardSerializer(award).data)

    # ── Student: my awards ─────────────────────────────────────────────────
    @extend_schema(
        summary="My awards",
        description="The current student's awards, each with its installments.",
        responses=AwardSerializer(many=True),
    )
    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        student = getattr(request.user, 'student_profile', None)
        if student is None:
            return Response({'error': 'No student profile found'}, status=404)
        qs = _award_queryset().filter(student=student)
        return Response(AwardSerializer(qs, many=True).data)

    # ── Student: submit a renewal ──────────────────────────────────────────
    @extend_schema(
        summary="Submit a renewal",
        description=("Multipart: cgpa, cgpa_scale, level, transcript(file). "
                     "Moves the open installment to pending_verification."),
        request=RenewalSubmitSerializer,
        responses=InstallmentSerializer,
    )
    @action(detail=True, methods=['post'], url_path='renew')
    def renew(self, request, pk=None):
        award = get_object_or_404(
            Award.objects.select_related('scheme', 'student'), pk=pk)
        student = getattr(request.user, 'student_profile', None)
        if student is None or award.student_id != student.pk:
            return Response({'error': 'Award not found'}, status=404)

        payload = RenewalSubmitSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        try:
            installment = submit_renewal(
                award=award,
                student=student,
                cgpa=data['cgpa'],
                level=data.get('level', ''),
                cgpa_scale=data.get('cgpa_scale'),
                transcript=data.get('transcript'),
            )
        except LifecycleError as exc:
            return Response({'error': str(exc)}, status=400)

        return Response(InstallmentSerializer(installment).data)

    # ── Staff: renewal queue ───────────────────────────────────────────────
    @extend_schema(
        summary="Renewal verification queue",
        description=("Installments awaiting verification by default; "
                     "?status=pending_renewal or all for visibility. ?cycle=."),
        parameters=[
            OpenApiParameter('status', str,
                             description="pending_verification | pending_renewal | all"),
            OpenApiParameter('cycle', str),
        ],
        responses=OpenApiResponse(description='Paginated installment queue.'),
    )
    @action(detail=False, methods=['get'], url_path='renewals')
    def renewals(self, request):
        status_param = request.query_params.get(
            'status', InstallmentStatus.PENDING_VERIFICATION)

        if status_param == 'all':
            statuses = [InstallmentStatus.PENDING_VERIFICATION,
                        InstallmentStatus.PENDING_RENEWAL]
        elif status_param in (InstallmentStatus.PENDING_VERIFICATION,
                              InstallmentStatus.PENDING_RENEWAL):
            statuses = [status_param]
        else:
            return Response(
                {"error": "'status' must be pending_verification, "
                          "pending_renewal or all."},
                status=400,
            )

        qs = (
            AwardInstallment.objects
            .filter(status__in=statuses)
            .select_related('award__scheme__provider', 'award__student',
                            'award__start_cycle', 'cycle')
            .order_by('cycle__start_year', 'year_index')
        )

        cycle_param = request.query_params.get('cycle')
        if cycle_param == 'active':
            active = Cycle.get_active()
            qs = qs.filter(cycle=active) if active else qs.none()
        elif cycle_param:
            qs = qs.filter(cycle_id=cycle_param)

        return self._paginate(request, qs, RenewalQueueSerializer)

    # ── Staff: CSV export ──────────────────────────────────────────────────
    @extend_schema(
        summary="Export awards",
        description="Same filters as the register. `&export=csv` streams a CSV.",
        parameters=[
            OpenApiParameter('status', str),
            OpenApiParameter('scheme', str),
            OpenApiParameter('cycle', str),
            OpenApiParameter('export', str, description="Set to `csv`."),
        ],
        responses=OpenApiResponse(description='JSON award list or a CSV file.'),
    )
    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        qs = _award_queryset()

        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        scheme_param = request.query_params.get('scheme')
        if scheme_param:
            qs = qs.filter(scheme_id=scheme_param)
        cycle_param = request.query_params.get('cycle')
        if cycle_param == 'active':
            active = Cycle.get_active()
            qs = qs.filter(start_cycle=active) if active else qs.none()
        elif cycle_param:
            qs = qs.filter(start_cycle_id=cycle_param)

        if request.query_params.get('export', '').lower() == 'csv':
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            filename = f"awards-{timezone.now():%Y%m%d}.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            writer = csv.writer(response)
            writer.writerow(AWARD_CSV_FIELDNAMES)
            for index, award in enumerate(qs, start=1):
                writer.writerow([index, *_award_csv_row(award)])
            return response

        return self._paginate(request, qs, AwardListSerializer)

    # ── Admin overrides ────────────────────────────────────────────────────
    @extend_schema(summary="Suspend an award",
                   request=AwardActionSerializer,
                   responses=OpenApiResponse(description='Updated award.'))
    @action(detail=True, methods=['post'], url_path='suspend')
    def suspend(self, request, pk=None):
        award = get_object_or_404(Award, pk=pk)
        payload = AwardActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            suspend_award(award=award, actor=request.user,
                          reason=payload.validated_data.get('reason', ''))
        except LifecycleError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(AwardSerializer(_award_queryset().get(pk=award.pk)).data)

    @extend_schema(summary="Terminate an award",
                   request=AwardActionSerializer,
                   responses=OpenApiResponse(description='Updated award.'))
    @action(detail=True, methods=['post'], url_path='terminate')
    def terminate(self, request, pk=None):
        award = get_object_or_404(Award, pk=pk)
        payload = AwardActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            terminate_award(award=award, actor=request.user,
                            reason=payload.validated_data.get('reason', ''))
        except LifecycleError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(AwardSerializer(_award_queryset().get(pk=award.pk)).data)


class InstallmentViewSet(viewsets.ViewSet):
    permission_classes = [IsVerifier]

    def get_permissions(self):
        if self.action == 'disburse':
            return [IsAdmin()]
        return [IsVerifier()]

    def _get_object(self, pk):
        return get_object_or_404(
            AwardInstallment.objects.select_related(
                'award__scheme__provider', 'award__student', 'cycle'),
            pk=pk,
        )

    @extend_schema(
        summary="Verify a renewal",
        description="{ action: approve|reject|withhold, note }",
        request=VerifyInstallmentSerializer,
        responses=RenewalQueueSerializer,
    )
    @action(detail=True, methods=['post'], url_path='verify')
    def verify(self, request, pk=None):
        installment = self._get_object(pk)
        payload = VerifyInstallmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            verify_installment(
                installment=installment,
                verifier=request.user,
                action=payload.validated_data['action'],
                note=payload.validated_data.get('note', ''),
            )
        except LifecycleError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(RenewalQueueSerializer(installment).data)

    @extend_schema(
        summary="Disburse an approved installment (admin only)",
        description="{ disbursement_ref }",
        request=DisburseSerializer,
        responses=InstallmentSerializer,
    )
    @action(detail=True, methods=['post'], url_path='disburse')
    def disburse(self, request, pk=None):
        installment = self._get_object(pk)
        payload = DisburseSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            disburse_installment(
                installment=installment,
                admin=request.user,
                disbursement_ref=payload.validated_data.get('disbursement_ref', ''),
            )
        except LifecycleError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(InstallmentSerializer(installment).data)


# ── CSV helpers ────────────────────────────────────────────────────────────

AWARD_CSV_FIELDNAMES = [
    'no', 'student_name', 'phone', 'email', 'ward', 'scheme', 'award_type',
    'year', 'status', 'annual_amount', 'start_cycle', 'tenure_confidence',
]


def _award_csv_row(award):
    return [
        award.student.full_name,
        award.student.phone_number,
        award.student.email,
        award.student.ward,
        award.scheme.name,
        award.scheme.award_type,
        f"{award.current_year_index}/{award.total_years}",
        award.status,
        award.annual_amount,
        award.start_cycle.name if award.start_cycle_id else '',
        award.tenure_confidence,
    ]
