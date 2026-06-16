import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

logger = logging.getLogger(__name__)

from .models import ApplicationStatus, ApplicationStatusHistory, REVIEWABLE_STATUSES
from .serializers import (
    ApplicationStatusHistorySerializer,
    ApplicationSubmitSerializer,
    ApplicationReviewSerializer,
    PROGRAMME_ANSWER_SERIALIZERS,
    REQUIRED_DOCUMENTS,
    serialize_application,
    serialize_application_list,
)
from .dynamic import (
    get_application_model,
    find_application,
    iter_application_models,
    applications_for_student,
    applications_by_status,
)
from .services.creation import create_application
from schemes.models import ScholarshipScheme
from accounts.permissions import IsVerifier

# ── Notification tasks ────────────────────────────────────────────────────────
from verification.tasks import (
    send_application_submitted_email,
    send_application_approved_email,
    send_application_rejected_email,
    send_double_dip_flagged_email,
)


def _dispatch_email(task, application, scheme):
    """Enqueue a notification task without letting broker/connection failures
    break the request. The application change has already been committed; a
    failure to queue the email must not turn a successful action into a 500."""
    try:
        task.delay(application_id=str(application.id), scheme_id=str(scheme.id))
    except Exception:
        logger.exception(
            "Failed to enqueue %s for application %s", task.name, application.id)


class ApplicationViewSet(viewsets.ViewSet):
    """Applications live in per-scheme tables (see applications/dynamic.py).

    This is a plain ViewSet rather than a ModelViewSet because there is no single
    queryset/model to bind to — every read either targets one scheme's table or
    unions across all of them.
    """
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination

    @staticmethod
    def _is_admin(user):
        return getattr(user, 'role', None) in ('admin', 'superadmin')

    @staticmethod
    def _is_staff(user):
        """Verifiers, admins and superadmins may read and review every
        application (not just their own)."""
        return getattr(user, 'role', None) in ('verifier', 'admin', 'superadmin')

    def _paginate(self, request, items, serialize):
        """Paginate an already-materialised list of rows and return a paginated
        Response. Keeps list endpoints from returning unbounded result sets."""
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(items, request, view=self)
        return paginator.get_paginated_response([serialize(r) for r in page])

    # ── List ────────────────────────────────────────────────────────────────
    @extend_schema(
        summary="List applications",
        description=(
            "Students receive only their own applications. Staff "
            "(verifier/admin/superadmin) receive every application across all "
            "scheme tables. Paginated."
        ),
        parameters=[
            OpenApiParameter('status', str, description='Filter by application status (staff only).'),
            OpenApiParameter('scheme', str, description='Filter to one scheme id (staff only).'),
        ],
        responses=OpenApiResponse(description='Paginated list of application summaries.'),
    )
    def list(self, request):
        user = request.user

        # Students only ever see their own applications; staff (verifier/admin)
        # see every application.
        if not self._is_staff(user):
            student = getattr(user, 'student_profile', None)
            rows = applications_for_student(student) if student else []
            return self._paginate(request, rows, serialize_application_list)

        status_filter = request.query_params.get('status')
        scheme_filter = request.query_params.get('scheme')

        # Narrow to one scheme's table when requested.
        if scheme_filter:
            scheme = ScholarshipScheme.objects.filter(id=scheme_filter).first()
            if not scheme or not scheme.table_name:
                return self._paginate(request, [], serialize_application_list)
            model = get_application_model(scheme)
            qs = model.objects.select_related(
                'scheme__provider', 'scheme__cycle', 'student__user'
            ).order_by('-created_at')
            if status_filter:
                qs = qs.filter(status=status_filter)
            return self._paginate(request, qs, serialize_application_list)

        # Otherwise union across every scheme table.
        if status_filter:
            rows = applications_by_status([status_filter])
        else:
            rows = []
            for _scheme, model in iter_application_models():
                rows.extend(model.objects.select_related(
                    'scheme__provider', 'scheme__cycle', 'student__user'))
            rows.sort(key=lambda r: r.created_at, reverse=True)
        return self._paginate(request, rows, serialize_application_list)

    # ── Retrieve ──────────────────────────────────────────────────────────────
    @extend_schema(
        summary="Retrieve one application",
        description='Full application detail. Students may only read their own.',
        responses=OpenApiResponse(description='Full application object (see FRONTEND_GUIDE.md for the shape).'),
    )
    def retrieve(self, request, pk=None):
        found = find_application(pk)
        if not found:
            return Response({"error": "Application not found"}, status=404)
        _scheme, _model, row = found

        # Students may only see their own; staff (verifier/admin) see any.
        if not self._is_staff(request.user):
            student = getattr(request.user, 'student_profile', None)
            if not student or row.student_id != student.pk:
                return Response({"error": "Application not found"}, status=404)

        return Response(serialize_application(row))

    # ── Mine ──────────────────────────────────────────────────────────────────
    @extend_schema(
        summary="My applications",
        description="The current student's own applications. Paginated.",
        responses=OpenApiResponse(description='Paginated list of the student\'s application summaries.'),
    )
    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        student = getattr(request.user, 'student_profile', None)
        if not student:
            return Response({"error": "No student profile found."}, status=400)
        rows = applications_for_student(student)
        return self._paginate(request, rows, serialize_application_list)

    # ── Verifier queue ──────────────────────────────────────────────────────────
    @extend_schema(
        summary="Verifier review queue",
        description=(
            "Every application in a reviewable state across all schemes. "
            "Verifier/admin only."
        ),
        parameters=[OpenApiParameter('status', str, description='Narrow to one reviewable status.')],
        responses=OpenApiResponse(description='Paginated list of application summaries.'),
    )
    @action(detail=False, methods=['get'], url_path='queue', permission_classes=[IsVerifier])
    def queue(self, request):
        """
        GET /applications/queue/

        The verifier worklist: every application across all schemes that is in a
        reviewable state, eligible or not. Paginated. Optional ?status= narrows
        to a single status (must be one of the reviewable statuses).
        """
        status_filter = request.query_params.get('status')
        if status_filter:
            if status_filter not in REVIEWABLE_STATUSES:
                return Response(
                    {"error": f"'{status_filter}' is not a reviewable status."},
                    status=400,
                )
            statuses = [status_filter]
        else:
            statuses = list(REVIEWABLE_STATUSES)

        rows = applications_by_status(statuses)
        return self._paginate(request, rows, serialize_application_list)

    # ── Flagged ───────────────────────────────────────────────────────────────
    @extend_schema(
        summary="Flagged (double-dip) applications",
        description='Applications in the double_dip_flag state. Verifier/admin only.',
        responses=OpenApiResponse(description='Paginated list of flagged application summaries.'),
    )
    @action(detail=False, methods=['get'], url_path='flagged', permission_classes=[IsVerifier])
    def flagged(self, request):
        rows = applications_by_status([ApplicationStatus.DOUBLE_DIP_FLAG])
        return self._paginate(request, rows, serialize_application_list)

    # ── By scheme ─────────────────────────────────────────────────────────────
    @extend_schema(
        summary="Applications by scheme",
        description='All applications in ONE scheme table, full detail. Verifier/admin only.',
        parameters=[
            OpenApiParameter('scheme_id', str, location=OpenApiParameter.PATH),
            OpenApiParameter('status', str, description='Filter to one status.'),
        ],
        responses=OpenApiResponse(description='{ scheme: {...}, applications: [...] }'),
    )
    @action(detail=False, methods=['get'], url_path='by-scheme/(?P<scheme_id>[^/.]+)',
            permission_classes=[IsVerifier])
    def by_scheme(self, request, scheme_id=None):
        """
        GET /applications/by-scheme/{scheme_id}/

        All applications in ONE scheme's table, with full details. Admin-only.
        Optional ?status= narrows to a single status.
        """
        scheme = ScholarshipScheme.objects.filter(id=scheme_id).first()
        if not scheme:
            return Response({"error": "Scheme not found"}, status=404)
        if not scheme.table_name:
            return Response({"error": "Scheme has no application table"}, status=400)

        model = get_application_model(scheme)
        qs = model.objects.select_related(
            'scheme__provider', 'scheme__cycle', 'student__user', 'reviewed_by'
        ).order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        apps = list(qs)
        return Response({
            "scheme": {
                "id":         str(scheme.id),
                "name":       scheme.name,
                "award_type": scheme.award_type,
                "total":      len(apps),
            },
            "applications": [serialize_application(a) for a in apps],
        })

    # ── Status history ────────────────────────────────────────────────────────
    @extend_schema(
        summary="Application status history",
        description='Audit trail of status transitions for one application.',
        responses=ApplicationStatusHistorySerializer(many=True),
    )
    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        history = ApplicationStatusHistory.objects.filter(
            application_id=pk
        ).select_related('changed_by').order_by('changed_at')
        return Response(ApplicationStatusHistorySerializer(history, many=True).data)

    # ── Submit ────────────────────────────────────────────────────────────────
    @extend_schema(
        summary="Submit an application",
        description=(
            "Validates the scheme is open/has slots, runs the EligibilityEngine, "
            "and creates the row in the scheme's table. A conflict routes to the "
            "double_dip_flag waiver flow."
        ),
        request=ApplicationSubmitSerializer,
        responses={201: OpenApiResponse(description=(
            '{ application_id, status, eligible, has_conflict, conflict_details, '
            'checks, message }'
        ))},
    )
    @action(detail=False, methods=['post'], url_path='submit')
    def submit(self, request):
        """
        POST /applications/submit/

        Creates the application row in THIS scheme's dedicated table.
        """
        submit_serializer = ApplicationSubmitSerializer(data=request.data)
        if not submit_serializer.is_valid():
            return Response(submit_serializer.errors, status=400)

        data = submit_serializer.validated_data

        # Get scheme
        scheme = ScholarshipScheme.objects.filter(id=data['scheme_id']).first()
        if not scheme:
            return Response({"error": "Scheme not found"}, status=404)
        if not scheme.is_open():
            return Response({"error": "This scheme is not currently accepting applications"}, status=400)
        if not scheme.has_slots():
            return Response({"error": "No slots remaining for this scheme"}, status=400)

        # Get student
        student = getattr(request.user, 'student_profile', None)
        if not student:
            return Response(
                {"error": "No student profile found. Complete your profile first."},
                status=400
            )

        model = get_application_model(scheme)

        # Duplicate check — the table is scheme-scoped, so any row by this student
        # means they have already applied to this scheme.
        if model.objects.filter(student=student).exists():
            return Response({"error": "You have already applied for this scheme"}, status=400)

        # ── Validate programme_answers against award type ──────────────────────
        answer_serializer_cls = PROGRAMME_ANSWER_SERIALIZERS.get(scheme.award_type)
        if answer_serializer_cls is None:
            return Response(
                {"error": f"Unknown award type '{scheme.award_type}'"},
                status=400,
            )

        answers_serializer = answer_serializer_cls(data=data['programme_answers'])
        if not answers_serializer.is_valid():
            return Response(
                {"error": "Invalid application details", "fields": answers_serializer.errors},
                status=400,
            )

        # ── Validate required documents per award type ─────────────────────────
        missing_docs = []
        for doc_key, doc_label in REQUIRED_DOCUMENTS.get(scheme.award_type, []):
            if not data.get('documents', {}).get(doc_key, '').strip():
                missing_docs.append(
                    dict(key=doc_key, label=f"Please upload your {doc_label}.")
                )
        if missing_docs:
            return Response(
                {"error": "Required documents are missing.", "documents": missing_docs},
                status=400,
            )

        # ── Build bank fields (collected fresh per application) ────────────────
        bank_fields = {
            'account_number':    data['bank_account_number'],
            'bank_code':         data['bank_code'],
            'bank_name':         data['bank_name'],
            'account_name':      data['bank_account_name'],
            'name_match_passed': data['bank_name_match_passed'],
        }

        # ── Create through the shared pipeline ─────────────────────────────────
        # Eligibility, status decision, and the atomic row + history insert all
        # live in create_application so the admin path cannot drift from this one.
        answers = answers_serializer.validated_data
        application, result = create_application(
            scheme    = scheme,
            student   = student,
            answers   = answers,
            bank      = bank_fields,
            self_declaration_received_support = data['self_declaration_received_support'],
            self_declaration_details          = data.get('self_declaration_details', []),
            attestation_agreed = data['attestation_agreed'],
            documents          = data.get('documents', {}),
            changed_by         = request.user,
            history_reason     = 'Auto-evaluated by EligibilityEngine on submission',
        )
        initial_status = application.status

        # ── Send notifications ────────────────────────────────────────────────
        # A conflict routes to the waiver flow; every other submission (eligible
        # or not) is now received and pending verifier review, so it gets the
        # standard submission confirmation.
        if result['has_conflict']:
            _dispatch_email(send_double_dip_flagged_email, application, scheme)
        else:
            _dispatch_email(send_application_submitted_email, application, scheme)

        return Response({
            "application_id":   str(application.id),
            "status":           application.status,
            "eligible":         result['eligible'],
            "has_conflict":     result['has_conflict'],
            "conflict_details": result['conflict_scheme_ids'],
            "checks":           result['checks'],
            "message":          self._status_message(initial_status),
        }, status=status.HTTP_201_CREATED)

    # ── Waiver ────────────────────────────────────────────────────────────────
    @extend_schema(
        summary="Submit a double-dip waiver",
        description=(
            "For an application in double_dip_flag: records the waiver and moves "
            "it to document_review for manual admin decision. No request body."
        ),
        request=None,
        responses=OpenApiResponse(description='{ message }'),
    )
    @action(detail=True, methods=['post'], url_path='waiver')
    def submit_waiver(self, request, pk=None):
        found = find_application(pk)
        if not found:
            return Response({"error": "Application not found"}, status=404)
        scheme, _model, application = found

        if application.status != ApplicationStatus.DOUBLE_DIP_FLAG:
            return Response(
                {"error": "This application does not have an active conflict flag"},
                status=400
            )

        # The waiver does NOT auto-resolve the conflict. Record that the student
        # submitted it and move into admin review with the conflict data intact.
        from_status = application.status
        application.waiver_submitted = True
        application.status           = ApplicationStatus.DOCUMENT_REVIEW
        application.save()

        ApplicationStatusHistory.objects.create(
            application_id = application.id,
            scheme         = scheme,
            from_status    = from_status,
            to_status      = ApplicationStatus.DOCUMENT_REVIEW,
            changed_by     = request.user,
            reason         = 'Student submitted waiver — sent to admin for review',
        )

        _dispatch_email(send_application_submitted_email, application, scheme)

        return Response({"message": "Waiver submitted. An administrator will review your application."})

    # ── Admin review ──────────────────────────────────────────────────────────
    @extend_schema(
        summary="Review an application (verifier decision)",
        description=(
            "Approve / reject / shortlist a reviewable application. `notes` is "
            "required when rejecting. Approval sets the student's active award and "
            "decrements the scheme's remaining slots. Verifier/admin only."
        ),
        request=ApplicationReviewSerializer,
        responses=OpenApiResponse(description='{ message, status }'),
    )
    @action(detail=True, methods=['post'], url_path='review', permission_classes=[IsVerifier])
    def review(self, request, pk=None):
        found = find_application(pk)
        if not found:
            return Response({"error": "Application not found"}, status=404)
        scheme, _model, application = found

        if application.status not in REVIEWABLE_STATUSES:
            return Response(
                {"error": f"Cannot review an application with status '{application.status}'"},
                status=400
            )

        review_serializer = ApplicationReviewSerializer(data=request.data)
        if not review_serializer.is_valid():
            return Response(review_serializer.errors, status=400)

        decision = review_serializer.validated_data['decision']
        notes    = review_serializer.validated_data.get('notes', '')

        from_status = application.status
        student     = application.student

        status_map = {
            'approved':    ApplicationStatus.APPROVED,
            'rejected':    ApplicationStatus.REJECTED,
            'shortlisted': ApplicationStatus.SHORTLISTED,
        }
        application.status         = status_map[decision]
        application.reviewed_by    = request.user
        application.reviewed_at    = timezone.now()
        application.reviewer_notes = notes

        if decision == 'rejected':
            application.rejection_reason = notes

        if decision == 'approved':
            student.active_award = scheme.name
            student.save(update_fields=['active_award'])
            scheme.remaining_slots = max(0, scheme.remaining_slots - 1)
            scheme.save(update_fields=['remaining_slots'])

        application.save()

        # When a verifier approves an application that failed eligibility or has
        # an unresolved conflict, record the override explicitly so the audit
        # trail shows it was a deliberate human decision, not an engine pass.
        overrides = []
        if decision == 'approved':
            if application.eligibility_passed is False:
                overrides.append('failed eligibility')
            if application.has_conflict:
                overrides.append('active-award conflict')

        reason = notes or f'Application {decision} by reviewer'
        if overrides:
            reason = f'{reason} [override: approved despite {", ".join(overrides)}]'

        ApplicationStatusHistory.objects.create(
            application_id = application.id,
            scheme         = scheme,
            from_status    = from_status,
            to_status      = application.status,
            changed_by     = request.user,
            reason         = reason,
        )

        # ── Send notifications ────────────────────────────────────────────────
        if decision == 'approved':
            _dispatch_email(send_application_approved_email, application, scheme)
        elif decision == 'rejected':
            _dispatch_email(send_application_rejected_email, application, scheme)

        return Response({
            "message": f"Application {decision} successfully.",
            "status":  application.status,
        })

    # ── Helpers ───────────────────────────────────────────────────────────────
    @staticmethod
    def _status_message(app_status):
        return {
            ApplicationStatus.SUBMITTED:       "Application submitted successfully. It will be reviewed by a verification officer.",
            ApplicationStatus.REJECTED:        "Your application does not meet the eligibility requirements.",
            ApplicationStatus.DOUBLE_DIP_FLAG: "Conflict detected. You have an active award. Submit a waiver to resolve this.",
        }.get(app_status, "Application processed.")
