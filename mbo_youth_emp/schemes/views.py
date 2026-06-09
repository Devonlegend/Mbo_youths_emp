from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import SchemeProvider, ScholarshipScheme, SchemeFormField
from .serializers import ScholarshipSchemeSerializer, SchemeFormFieldSerializer
from accounts.permissions import IsAdmin
from audit.models import AuditLog
from notifications.models import Notification
from students.models import Student
from .models import SchemeProvider


class ScholarshipSchemeViewSet(viewsets.ModelViewSet):
    queryset = ScholarshipScheme.objects.all().order_by('-created_at')
    serializer_class = ScholarshipSchemeSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'form_fields']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'role') and user.role == 'verifier':
            return ScholarshipScheme.objects.none()
        if self.action in ['list', 'retrieve']:
            if self.request.user.is_authenticated and hasattr(self.request.user, 'role') and self.request.user.role in ['admin', 'superadmin']:
                return super().get_queryset()
            return ScholarshipScheme.objects.filter(is_published=True)
        return super().get_queryset()

    def perform_create(self, serializer):
        print("VALIDATED DATA:", serializer.validated_data)
        provider, created = SchemeProvider.objects.get_or_create(
            name="RMHCDT",
            defaults={
                'provider_type': 'ngo',
            }
        )
        total = serializer.validated_data.get('total_slots', 0)
        scheme = serializer.save(provider=provider, remaining_slots=total)
        AuditLog.objects.create(
            admin       = self.request.user,
            action      = f"Created new scheme: {scheme.name} (type: {scheme.award_type})",
            entity_type = "Scheme",
            entity_id   = str(scheme.id),
        )

    def perform_update(self, serializer):
        scheme = serializer.save()
        AuditLog.objects.create(
            admin       = self.request.user,
            action      = f"Updated scheme: {scheme.name}",
            entity_type = "Scheme",
            entity_id   = str(scheme.id),
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            admin       = self.request.user,
            action      = f"Deleted scheme: {instance.name}",
            entity_type = "Scheme",
            entity_id   = str(instance.id),
        )
        instance.delete()

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        scheme = self.get_object()
        if scheme.is_published:
            return Response({"message": "Scheme is already published."}, status=status.HTTP_200_OK)
        scheme.is_published = True
        scheme.save()
        AuditLog.objects.create(
            admin       = request.user,
            action      = f"Published scheme: {scheme.name}",
            entity_type = "Scheme",
            entity_id   = str(scheme.id),
        )
        students = Student.objects.select_related('user').all()
        Notification.objects.bulk_create([
            Notification(
                user    = s.user,
                type    = 'programme',
                title   = 'New programme available',
                message = f'{scheme.name} is now open for applications. Log in to apply before slots run out.',
            )
            for s in students
        ])
        return Response({"message": "Scheme published successfully."})

    @action(detail=True, methods=['post'], url_path='close')
    def close(self, request, pk=None):
        scheme = self.get_object()
        if not scheme.is_active:
            return Response({"message": "Scheme is already closed."}, status=status.HTTP_200_OK)
        scheme.is_active = False
        scheme.save()
        AuditLog.objects.create(
            admin       = request.user,
            action      = f"Closed scheme: {scheme.name}",
            entity_type = "Scheme",
            entity_id   = str(scheme.id),
        )
        students = Student.objects.select_related('user').all()
        Notification.objects.bulk_create([
            Notification(
                user    = s.user,
                type    = 'deadline',
                title   = 'Programme closed',
                message = f'{scheme.name} is now closed and no longer accepting applications.',
            )
            for s in students
        ])
        return Response({"message": "Scheme closed successfully."})

    @action(detail=True, methods=['post'], url_path='reopen')
    def reopen(self, request, pk=None):
        scheme = self.get_object()
        if scheme.is_active:
            return Response({"message": "Scheme is already open."}, status=status.HTTP_200_OK)
        scheme.is_active = True
        scheme.save()
        AuditLog.objects.create(
            admin       = request.user,
            action      = f"Reopened scheme: {scheme.name}",
            entity_type = "Scheme",
            entity_id   = str(scheme.id),
        )
        students = Student.objects.select_related('user').all()
        Notification.objects.bulk_create([
            Notification(
                user    = s.user,
                type    = 'programme',
                title   = 'Programme reopened',
                message = f'{scheme.name} is now accepting applications again.',
            )
            for s in students
        ])
        return Response({"message": "Scheme reopened successfully."})

    @action(detail=True, methods=['get', 'post'], url_path='fields')
    def form_fields(self, request, pk=None):
        scheme = self.get_object()

        if request.method == 'GET':
            fields = scheme.form_fields.all()
            return Response(SchemeFormFieldSerializer(fields, many=True).data)

        if request.method == 'POST':
            scheme.form_fields.all().delete()
            fields_data = request.data if isinstance(request.data, list) else []
            for i, field in enumerate(fields_data):
                field['order'] = i
                serializer = SchemeFormFieldSerializer(data=field)
                if serializer.is_valid():
                    serializer.save(scheme=scheme)
            return Response(
                SchemeFormFieldSerializer(scheme.form_fields.all(), many=True).data,
                status=status.HTTP_201_CREATED
            )