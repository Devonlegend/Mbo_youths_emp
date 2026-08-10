import json
import logging
import uuid

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from accounts.validators import validate_upload, FileValidationError

logger = logging.getLogger(__name__)

from .models import ApplicationStatus, ApplicationStatusHistory, REVIEWABLE_STATUSES, PendingApplicationNotification
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
from .services.slots import consume_slot, SlotUnavailable
from .services.withdrawal import withdraw_application
from schemes.models import ScholarshipScheme
from accounts.permissions import IsVerifier, IsAdmin

# ── Notification tasks ────────────────────────────────────────────────────────
# send_application_rejected_email is intentionally NOT imported: rejection emails
# are deprecated. Approval emails are deferred until a scheme is Published.
from verification.tasks import (
    send_application_submitted_email,
    send_application_approved_email,
    send_double_dip_flagged_email,
)
from notifications.helpers import (
    notify_application_submitted,
    notify_award_conflict,
    notify_application_status_update,
    notify_approval_published,
    notify_new_application_in_queue,
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
        parameters=[OpenApiParameter('id', uuid.UUID, location=OpenApiParameter.PATH,
                                     description='Application UUID')],
        responses=OpenApiResponse(description='Full application object.'),
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
        # Live counts: how many still need a decision, and how many approval
        # emails are staged for the Publish button.
        pending_review = model.objects.filter(status__in=REVIEWABLE_STATUSES).count()
        unpublished = PendingApplicationNotification.objects.filter(
            scheme=scheme, sent_at__isnull=True
        ).count()
        return Response({
            "scheme": {
                "id":         str(scheme.id),
                "name":       scheme.name,
                "award_type": scheme.award_type,
                "total":      len(apps),
            },
            "pending_review": pending_review,
            "unpublished":    unpublished,
            "applications":   [serialize_application(a) for a in apps],
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

        Accepts multipart: a `payload` text part with the JSON body, plus each
        document as a file part keyed by its field name. Falls back to a plain
        JSON body (no files) for non-browser callers.
        """
        raw = request.data.get('payload')
        if raw is not None:
            try:
                parsed = json.loads(raw)
            except (TypeError, ValueError):
                return Response({"error": "Malformed payload."}, status=400)
        else:
            parsed = request.data

        submit_serializer = ApplicationSubmitSerializer(data=parsed)
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

        # ── Upload documents to Cloudinary, build the {key: url} dict ──────────
        # Same mechanism as passport/certificate on register: validate at the
        # request boundary, then save through default_storage (Cloudinary).
        # Uploaded files win; any URLs in the JSON payload are a fallback for
        # non-browser callers that pass already-hosted documents.
        documents = dict(data.get('documents', {}))
        for doc_key, uploaded in request.FILES.items():
            try:
                validate_upload(uploaded, doc_key, required=True)
            except FileValidationError as exc:
                return Response({"error": str(exc)}, status=400)
            stored = default_storage.save(
                f"application_documents/{doc_key}/{uploaded.name}", uploaded
            )
            documents[doc_key] = default_storage.url(stored)

        # ── Validate required documents per award type ─────────────────────────
        missing_docs = []
        for doc_key, doc_label in REQUIRED_DOCUMENTS.get(scheme.award_type, []):
            if not documents.get(doc_key, '').strip():
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
            documents          = documents,
            changed_by         = request.user,
            history_reason     = 'Auto-evaluated by EligibilityEngine on submission',
        )
        initial_status = application.status

        # ── Send notifications ────────────────────────────────────────────────

        if result['has_conflict']:
            _dispatch_email(send_double_dip_flagged_email, application, scheme)
            try:
                notify_award_conflict(request.user, application)
            except Exception:
                logger.exception("Failed to create conflict notification")
        else:
            _dispatch_email(send_application_submitted_email, application, scheme)
            try:
                notify_application_submitted(request.user, application)
            except Exception:
                logger.exception("Failed to create submission notification")

        # Alert all verifier/admin staff that a new application is in the queue.
        try:
            notify_new_application_in_queue(application)
        except Exception:
            logger.exception("Failed to create staff queue alert")

        return Response({
            "application_id":   str(application.id),
            "status":           application.status,
            "eligible":         result['eligible'],
            "has_conflict":     result['has_conflict'],
            "conflict_details": result['conflict_scheme_ids'],
            "checks":           result['checks'],
            "message":          self._status_message(initial_status),
        }, status=status.HTTP_201_CREATED)

    # ── Staff create (admin) ─────────────────────────────────────────────────
    @extend_schema(
        summary="Create an application (staff/admin)",
        description=(
            "Admin creates an application on behalf of a student. Accepts a "
            "student_id instead of using the authenticated user's profile. "
            "Skips scheme-open, slot, and duplicate checks. Optional "
            "status_override sets the initial status directly."
        ),
        request=ApplicationSubmitSerializer,
        responses={201: OpenApiResponse(description=(
            '{ application_id, status, eligible, has_conflict, checks, message }'
        ))},
    )
    @action(detail=False, methods=['post'], url_path='staff-create', permission_classes=[IsAdmin])
    def staff_create(self, request):
        raw = request.data.get('payload')
        if raw is not None:
            try:
                parsed = json.loads(raw)
            except (TypeError, ValueError):
                return Response({"error": "Malformed payload."}, status=400)
        else:
            parsed = request.data

        # Require student_id
        student_id = parsed.get('student_id')
        if not student_id:
            return Response({"error": "student_id is required."}, status=400)

        from students.models import Student
        try:
            student = Student.objects.get(pk=student_id)
        except (Student.DoesNotExist, ValueError):
            return Response({"error": "Student not found."}, status=404)

        submit_serializer = ApplicationSubmitSerializer(data=parsed)
        if not submit_serializer.is_valid():
            return Response(submit_serializer.errors, status=400)

        data = submit_serializer.validated_data

        scheme = ScholarshipScheme.objects.filter(id=data['scheme_id']).first()
        if not scheme:
            return Response({"error": "Scheme not found"}, status=404)

        model = get_application_model(scheme)

        # ── Validate programme_answers against award type ──────────────────
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

        # ── Upload documents to Cloudinary ─────────────────────────────────
        documents = dict(data.get('documents', {}))
        for doc_key, uploaded in request.FILES.items():
            try:
                validate_upload(uploaded, doc_key, required=True)
            except FileValidationError as exc:
                return Response({"error": str(exc)}, status=400)
            stored = default_storage.save(
                f"application_documents/{doc_key}/{uploaded.name}", uploaded
            )
            documents[doc_key] = default_storage.url(stored)

        # ── Build bank fields ──────────────────────────────────────────────
        bank_fields = {
            'account_number':    data['bank_account_number'],
            'bank_code':         data['bank_code'],
            'bank_name':         data['bank_name'],
            'account_name':      data['bank_account_name'],
            'name_match_passed': data['bank_name_match_passed'],
        }

        # ── Create through the shared pipeline ─────────────────────────────
        answers = answers_serializer.validated_data
        application, result = create_application(
            scheme    = scheme,
            student   = student,
            answers   = answers,
            bank      = bank_fields,
            self_declaration_received_support = data['self_declaration_received_support'],
            self_declaration_details          = data.get('self_declaration_details', []),
            attestation_agreed = data['attestation_agreed'],
            documents          = documents,
            changed_by         = request.user,
            history_reason     = f'Created by admin {request.user.get_full_name() or request.user.email}',
        )

        # ── Optional status override ───────────────────────────────────────
        status_override = parsed.get('status_override')
        valid_overrides = {s.value for s in ApplicationStatus}
        if status_override and status_override in valid_overrides:
            from_status = application.status
            try:
                with transaction.atomic():
                    if status_override == ApplicationStatus.APPROVED:
                        # Admin approval also respects the slot cap (atomic take).
                        if not consume_slot(scheme):
                            raise SlotUnavailable(
                                "No slots remaining for this scheme — cannot approve.")
                        student.active_award = scheme.name
                        student.save(update_fields=['active_award'])
                    application.status = status_override
                    application.save()
                    ApplicationStatusHistory.objects.create(
                        application_id = application.id,
                        scheme         = scheme,
                        from_status    = from_status,
                        to_status      = status_override,
                        changed_by     = request.user,
                        reason         = f'Admin set initial status to {status_override}',
                    )
            except SlotUnavailable as exc:
                return Response({"error": str(exc)}, status=400)

        return Response({
            "application_id":   str(application.id),
            "status":           application.status,
            "eligible":         result['eligible'],
            "has_conflict":     result['has_conflict'],
            "conflict_details": result['conflict_scheme_ids'],
            "checks":           result['checks'],
            "message":          self._status_message(application.status),
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
        try:
            with transaction.atomic():
                # Approval respects the slot cap: consume a slot atomically and
                # refuse the decision when none is left. `SlotUnavailable`
                # rolls back the whole decision (including the slot take) and is
                # converted to a 400 below.
                if decision == 'approved' and not consume_slot(scheme):
                    raise SlotUnavailable("No slots remaining for this scheme — cannot approve.")

                application.status         = status_map[decision]
                application.reviewed_by    = request.user
                application.reviewed_at    = timezone.now()
                application.reviewer_notes = notes

                if decision == 'rejected':
                    application.rejection_reason = notes

                if decision == 'approved':
                    student.active_award = scheme.name
                    student.save(update_fields=['active_award'])

                application.save()

                # When a verifier approves an application that failed eligibility
                # or has an unresolved conflict, record the override explicitly
                # so the audit trail shows it was a deliberate human decision,
                # not an engine pass.
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

                # ── Notifications ─────────────────────────────────────────────
                # Approval emails are NOT sent here. They are staged as a
                # pending notification and dispatched in bulk when a reviewer
                # Publishes the scheme (see the `publish` action). Rejection
                # emails are deprecated entirely and never sent.
                if decision == 'approved':
                    PendingApplicationNotification.objects.create(
                        application_id    = application.id,
                        scheme            = scheme,
                        notification_type = 'approved',
                    )
        except SlotUnavailable as exc:
            return Response({"error": str(exc)}, status=400)

        # In-app notification for the student (after the transaction commits).
        try:
            notify_application_status_update(student.user, application, decision)
        except Exception:
            logger.exception("Failed to create status update notification")

        return Response({
            "message": f"Application {decision} successfully.",
            "status":  application.status,
            "note":    ("Approval email will be sent when this scheme is published."
                        if decision == 'approved' else None),
        })

    # ── Withdraw an approval (release slot) ────────────────────────────────────
    @extend_schema(
        summary="Withdraw an approved application (releases its slot)",
        description=(
            "Revokes an approved application: moves it to `withdrawn`, releases "
            "its slot back to the scheme (remaining_slots +1), and clears the "
            "student's active-award label if it points at this scheme. "
            "Verifier/admin only."
        ),
        request=None,
        responses=OpenApiResponse(description='{ message, status, remaining_slots }'),
    )
    @action(detail=True, methods=['post'], url_path='withdraw', permission_classes=[IsVerifier])
    def withdraw(self, request, pk=None):
        found = find_application(pk)
        if not found:
            return Response({"error": "Application not found"}, status=404)
        scheme, _model, application = found

        if application.status != ApplicationStatus.APPROVED:
            return Response(
                {"error": f"Only an approved application can be withdrawn "
                          f"(current: '{application.status}')."},
                status=400,
            )

        application, remaining = withdraw_application(application, scheme, request.user)

        try:
            notify_application_status_update(application.student.user, application, 'withdrawn')
        except Exception:
            logger.exception("Failed to create withdraw notification")

        return Response({
            "message":         "Application withdrawn and its slot released.",
            "status":          application.status,
            "remaining_slots": remaining,
        })

    # ── Publish scheme approvals ──────────────────────────────────────────────
    @extend_schema(
        summary="Publish approval emails for a scheme",
        description=(
            "Sends all staged approval emails for one scheme that have not yet "
            "been sent. Idempotent — already-sent notifications are skipped. "
            "Verifier/admin only."
        ),
        request=None,
        responses=OpenApiResponse(description='{ sent, scheme }'),
    )
    @action(detail=False, methods=['post'],
            url_path='publish/(?P<scheme_id>[^/.]+)',
            permission_classes=[IsVerifier])
    def publish(self, request, scheme_id=None):
        """
        POST /applications/publish/{scheme_id}/

        Dispatches approval emails for every unsent PendingApplicationNotification
        for the given scheme. Marks each row's `sent_at` on success.
        """
        scheme = ScholarshipScheme.objects.filter(id=scheme_id).first()
        if not scheme:
            return Response({"error": "Scheme not found"}, status=404)

        pending = PendingApplicationNotification.objects.filter(
            scheme=scheme, sent_at__isnull=True,
        ).select_related('scheme')

        sent = 0
        model = None
        for notification in pending:
            if model is None and scheme.table_name:
                model = get_application_model(scheme)
            # Resolve the application row (may have been deleted, skip gracefully)
            if model:
                row = model.objects.filter(id=notification.application_id).first()
            else:
                row = None
            if row is not None:
                _dispatch_email(send_application_approved_email, row, scheme)
                try:
                    notify_approval_published(row.student.user, row)
                except Exception:
                    logger.exception(
                        "Failed to create publish notification for app %s", row.id)
                sent += 1
            notification.sent_at = timezone.now()
            notification.save(update_fields=['sent_at'])

        return Response({
            "sent":   sent,
            "scheme": scheme.name,
        })

    # ── Schemes overview (for scheme-card grid) ──────────────────────────────
    @extend_schema(
        summary="Schemes overview with pending counts",
        description=(
            "Returns every scheme that has applications, with counts of pending "
            "review and unpublished approval notifications. Verifier/admin only."
        ),
        responses=OpenApiResponse(description='[{ scheme, pending_review, unpublished }]'),
    )
    @action(detail=False, methods=['get'],
            url_path='schemes-overview',
            permission_classes=[IsVerifier])
    def schemes_overview(self, request):
        """
        GET /applications/schemes-overview/

        Drives the scheme-card grid on the verifier/admin dashboard. For every
        scheme whose table exists, returns the scheme metadata plus how many
        applications still need review and how many approved emails are staged
        but not yet published.
        """
        result = []
        for scheme, model in iter_application_models():
            total_in_scheme = model.objects.count()
            if total_in_scheme == 0:
                continue

            pending_review = model.objects.filter(
                status__in=REVIEWABLE_STATUSES,
            ).count()
            unpublished = PendingApplicationNotification.objects.filter(
                scheme=scheme, sent_at__isnull=True,
            ).count()

            result.append({
                "scheme": {
                    "id":           str(scheme.id),
                    "name":         scheme.name,
                    "award_type":   scheme.award_type,
                    "total_slots":  scheme.total_slots,
                    "remaining_slots": scheme.remaining_slots,
                },
                "pending_review": pending_review,
                "unpublished":    unpublished,
            })

        return Response(result)

    # ── Helpers ───────────────────────────────────────────────────────────────
    @staticmethod
    def _status_message(app_status):
        return {
            ApplicationStatus.SUBMITTED:       "Application submitted successfully. It will be reviewed by a verification officer.",
            ApplicationStatus.REJECTED:        "Your application does not meet the eligibility requirements.",
            ApplicationStatus.DOUBLE_DIP_FLAG: "Conflict detected. You have an active award. Submit a waiver to resolve this.",
        }.get(app_status, "Application processed.")
