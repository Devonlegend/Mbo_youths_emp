from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db import transaction
from django.utils import timezone
from django.db import models

from .models import Application, ApplicationStatus, ApplicationStatusHistory
from .serializers import ApplicationSerializer, DETAILS_SERIALIZER_BY_TYPE, normalize_details_payload
from .services.eligibility import EligibilityEngine
from schemes.models import ScholarshipScheme
from accounts.permissions import IsAdmin, IsVerifier, IsStudent
from audit.models import AuditLog
from accounts.services import send_application_submitted_email
from notifications.models import Notification


class ApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            student_profile = getattr(user, 'student_profile', None)
            if student_profile is None:
                return Application.objects.none()
            return Application.objects.filter(
                student=student_profile
            ).select_related('scheme', 'student')
        return Application.objects.all().select_related('scheme', 'student')

    @action(detail=False, methods=['post'], url_path='submit')
    def submit(self, request):
        scheme_id = request.data.get('scheme_id')
        if not scheme_id:
            return Response({"error": "scheme_id is required"}, status=400)

        scheme = ScholarshipScheme.objects.filter(id=scheme_id).first()
        if not scheme:
            return Response({"error": "Scheme not found"}, status=404)

        try:
            student = request.user.student_profile
        except Exception:
            return Response({"error": "No student profile found. Complete your profile first."}, status=400)

        if not student.is_verified:
            return Response(
                {"error": "Your account must be verified by an admin before you can apply for any scheme."},
                status=403
            )

        if Application.objects.filter(student=student, scheme=scheme).exists():
            return Response({"error": "You have already applied for this scheme"}, status=400)

        details_serializer_cls = DETAILS_SERIALIZER_BY_TYPE.get(scheme.award_type)
        if details_serializer_cls is None:
            return Response(
                {"error": f"Unsupported award_type '{scheme.award_type}'"},
                status=400,
            )

        raw_details_payload = request.data.get('details', request.data)
        details_payload = normalize_details_payload(scheme.award_type, raw_details_payload)
        if not isinstance(details_payload, dict):
            return Response(
                {"error": "details object is required for this award type",
                 "award_type": scheme.award_type,
                 "expected_fields": list(details_serializer_cls().get_fields().keys())},
                status=400,
            )

        allowed_fields = set(details_serializer_cls().get_fields().keys())
        details_payload = {
            key: value
            for key, value in details_payload.items()
            if key in allowed_fields
        }

        details_serializer = details_serializer_cls(data=details_payload)
        if not details_serializer.is_valid():
            return Response(
                {"error": "Invalid application details",
                 "field_errors": details_serializer.errors},
                status=400,
            )

        result = EligibilityEngine.run_full_check(student, scheme, details_serializer.validated_data)

        if result['has_conflict']:
            initial_status = ApplicationStatus.DOUBLE_DIP_FLAG
        elif not result['eligible']:
            initial_status = ApplicationStatus.REJECTED
        else:
            initial_status = ApplicationStatus.SUBMITTED

        with transaction.atomic():
            application = Application.objects.create(
                student             = student,
                scheme              = scheme,
                status              = initial_status,
                submission_date     = timezone.now(),
                eligibility_passed  = result['eligible'],
                eligibility_details = result['checks'],
                has_conflict        = result['has_conflict'],
                conflict_scheme_ids = result['conflict_scheme_ids'],
            )
            # ── Decrement remaining slots ──────────────────────────────
            if initial_status == ApplicationStatus.SUBMITTED:
                ScholarshipScheme.objects.filter(id=scheme.id).update(
                    remaining_slots=models.F('remaining_slots') - 1
                )

            details_serializer.save(application=application)
            ApplicationStatusHistory.objects.create(
                application = application,
                from_status = '',
                to_status   = initial_status,
                changed_by  = request.user,
                reason      = 'Auto-evaluated by EligibilityEngine on submission'
            )

            if initial_status == ApplicationStatus.DOUBLE_DIP_FLAG:
                Notification.objects.create(
                    user    = request.user,
                    type    = 'alert',
                    title   = 'Application flagged — conflict detected',
                    message = f'Your {scheme.name} application was flagged due to an existing award conflict. You may submit a waiver to resolve this.',
                )
            elif initial_status == ApplicationStatus.REJECTED:
                Notification.objects.create(
                    user    = request.user,
                    type    = 'alert',
                    title   = 'Application not eligible',
                    message = f'Your {scheme.name} application did not meet the eligibility requirements for this cycle.',
                )
            else:
                Notification.objects.create(
                    user    = request.user,
                    type    = 'application',
                    title   = 'Application submitted successfully',
                    message = f'Your {scheme.name} application has been received and is under review.',
                )
        if initial_status == ApplicationStatus.SUBMITTED:
            try:
                send_application_submitted_email(
                    to_email    = request.user.email,
                    firstname   = student.firstname,
                    scheme_name = scheme.name,
                )
            except Exception:
                import logging
                logging.getLogger(__name__).exception(
                "Failed to send application submitted email to %s", request.user.email
            )                

        return Response({
            "application_id":   str(application.id),
            "status":           application.status,
            "award_type":       scheme.award_type,
            "details":          details_serializer.data,
            "eligible":         result['eligible'],
            "has_conflict":     result['has_conflict'],
            "conflict_details": result['conflict_scheme_ids'],
            "checks":           result['checks'],
            "message":          self._status_message(initial_status),
        }, status=status.HTTP_201_CREATED)

    @staticmethod
    def _status_message(app_status):
        messages = {
            ApplicationStatus.SUBMITTED:       "Application submitted successfully. Documents will be reviewed shortly.",
            ApplicationStatus.REJECTED:        "Your application does not meet the eligibility requirements for this scheme.",
            ApplicationStatus.DOUBLE_DIP_FLAG: "Conflict detected. You have an active award that conflicts with this scheme. You may submit a waiver to resolve this.",
        }
        return messages.get(app_status, "Application processed.")

    @action(detail=True, methods=['post'], url_path='waiver')
    def submit_waiver(self, request, pk=None):
        application = self.get_object()

        if application.status != ApplicationStatus.DOUBLE_DIP_FLAG:
            return Response({"error": "This application does not have an active conflict flag"}, status=400)

        application.waiver_submitted = True
        application.status           = ApplicationStatus.DOCUMENT_REVIEW
        application.save()

        ApplicationStatusHistory.objects.create(
            application = application,
            from_status = ApplicationStatus.DOUBLE_DIP_FLAG,
            to_status   = ApplicationStatus.DOCUMENT_REVIEW,
            changed_by  = request.user,
            reason      = 'Student submitted waiver — sent to admin for review'
        )

        Notification.objects.create(
            user    = request.user,
            type    = 'application',
            title   = 'Waiver submitted',
            message = f'Your waiver for {application.scheme.name} has been submitted and is under admin review.',
        )

        return Response({"message": "Waiver submitted. An administrator will review your application."})

    @action(detail=True, methods=['post'], url_path='review', permission_classes=[IsAuthenticated, IsAdmin | IsVerifier])
    def review(self, request, pk=None):
        application = self.get_object()

        if application.status not in [
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.DOUBLE_DIP_FLAG,
            ApplicationStatus.DOCUMENT_REVIEW,
        ]:
            return Response({"error": "Only submitted applications can be reviewed"}, status=400)

        approve = request.data.get('approve')
        notes   = request.data.get('notes', '')

        if approve is None:
            return Response({"error": "approve field is required and must be true or false"}, status=400)

        previous_status = application.status
        new_status = ApplicationStatus.APPROVED if approve else ApplicationStatus.REJECTED

        application.status           = new_status
        application.reviewed_by      = request.user
        application.reviewed_at      = timezone.now()
        application.reviewer_notes   = notes
        if not approve:
            application.rejection_reason = notes
        application.save()

        if approve:
            student = application.student
            student.active_award = application.scheme.name
            student.save(update_fields=['active_award'])

        ApplicationStatusHistory.objects.create(
            application = application,
            from_status = previous_status,
            to_status   = new_status,
            changed_by  = request.user,
            reason      = notes or ('Approved by reviewer' if approve else 'Rejected by reviewer'),
        )

        AuditLog.objects.create(
            admin       = request.user,
            action      = f"{'Approved' if approve else 'Rejected'} application for "
                          f"{application.student.firstname} {application.student.lastname} "
                          f"— {application.scheme.name}. Note: {notes or 'None'}",
            entity_type = "Application",
            entity_id   = str(application.id),
        )

        Notification.objects.create(
            user    = application.student.user,
            type    = 'application',
            title   = f'Application {"approved" if approve else "rejected"}',
            message = f'Your {application.scheme.name} application has been {"approved. Congratulations!" if approve else f"rejected. Reason: {notes or chr(8212)}"}',
        )

        return Response({
            "application_id": str(application.id),
            "status":         application.status,
            "reviewed_by":    str(request.user.id),
            "reviewed_at":    application.reviewed_at.isoformat(),
        })