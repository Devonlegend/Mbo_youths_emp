from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.utils import timezone

from .models import Application, ApplicationStatus, ApplicationStatusHistory
from .services.eligibility import EligibilityEngine
from schemes.models import ScholarshipScheme
from accounts.permissions import IsAdmin, IsStudent


class ApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Students see only their own applications
        if user.role == 'student':
            student_profile = getattr(user, 'student_profile', None)
            if student_profile is None:
                return Application.objects.none()
            return Application.objects.filter(
                student=student_profile
            ).select_related('scheme', 'student')
        # Admins see everything
        return Application.objects.all().select_related('scheme', 'student')

    @action(detail=False, methods=['post'], url_path='submit')
    def submit(self, request):
        """
        POST /applications/submit/
        Body: { "scheme_id": "uuid" }

        This is the main entry point. It:
        1. Finds the student's profile
        2. Finds the scheme
        3. Runs the full eligibility engine
        4. Creates the application with the result
        5. Returns everything to the frontend
        """
        scheme_id = request.data.get('scheme_id')
        if not scheme_id:
            return Response({"error": "scheme_id is required"}, status=400)

        # Get scheme
        scheme = ScholarshipScheme.objects.filter(id=scheme_id).first()
        if not scheme:
            return Response({"error": "Scheme not found"}, status=404)

        # Get student profile linked to this user
        try:
            student = request.user.student_profile
        except Exception:
            return Response({"error": "No student profile found. Complete your profile first."}, status=400)

        # Check for duplicate application
        if Application.objects.filter(student=student, scheme=scheme).exists():
            return Response({"error": "You have already applied for this scheme"}, status=400)

        # ── RUN THE ELIGIBILITY ENGINE ──────────────────────────────────
        result = EligibilityEngine.run_full_check(student, scheme)
        # ───────────────────────────────────────────────────────────────

        # Determine initial status based on result
        if result['has_conflict']:
            initial_status = ApplicationStatus.DOUBLE_DIP_FLAG
        elif not result['eligible']:
            initial_status = ApplicationStatus.REJECTED
        else:
            initial_status = ApplicationStatus.SUBMITTED

        # Create the application record
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

        # Log the status to history
        ApplicationStatusHistory.objects.create(
            application = application,
            from_status = '',
            to_status   = initial_status,
            changed_by  = request.user,
            reason      = 'Auto-evaluated by EligibilityEngine on submission'
        )

        # Friendly response
        return Response({
            "application_id": str(application.id),
            "status":         application.status,
            "eligible":       result['eligible'],
            "has_conflict":   result['has_conflict'],
            "conflict_details": result['conflict_scheme_ids'],
            "checks":         result['checks'],
            "message":        self._status_message(initial_status),
        }, status=status.HTTP_201_CREATED)

    @staticmethod
    def _status_message(app_status):
        messages = {
            ApplicationStatus.SUBMITTED:  "Application submitted successfully. Documents will be reviewed shortly.",
            ApplicationStatus.REJECTED:  "Your application does not meet the eligibility requirements for this scheme.",
            ApplicationStatus.DOUBLE_DIP_FLAG: "Conflict detected. You have an active award that conflicts with this scheme. You may submit a waiver to resolve this.",
        }
        return messages.get(app_status, "Application processed.")

    @action(detail=True, methods=['post'], url_path='waiver')
    def submit_waiver(self, request, pk=None):
        """
        POST /applications/{id}/waiver/
        Student formally waives their conflicting award to clear the flag.
        """
        application = self.get_object()

        if application.status != ApplicationStatus.DOUBLE_DIP_FLAG:
            return Response({"error": "This application does not have an active conflict flag"}, status=400)

        application.waiver_submitted = True
        application.status           = ApplicationStatus.SUBMITTED
        application.has_conflict     = False
        application.save()

        ApplicationStatusHistory.objects.create(
            application = application,
            from_status = ApplicationStatus.DOUBLE_DIP_FLAG,
            to_status   = ApplicationStatus.SUBMITTED,
            changed_by  = request.user,
            reason      = 'Student submitted waiver — conflict cleared'
        )

        # Clear the active award from their student profile
        application.student.active_award = ''
        application.student.save()

        return Response({"message": "Waiver accepted. Application is now under review."})

    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, pk=None):
        """
        POST /applications/{id}/review/
        Admin reviews the application and approves or rejects it.
        Body: { "approve": true/false, "notes": "optional notes" }
        """
        application = self.get_object()

        if application.status not in [ApplicationStatus.SUBMITTED, ApplicationStatus.DOUBLE_DIP_FLAG]:
            return Response({"error": "Only submitted applications can be reviewed"}, status=400)

        approve = request.data.get('approve')
        notes   = request.data.get('notes', '')

        if approve is None:
            return Response({"error": "approve field is required and must be true or false"}, status=400)