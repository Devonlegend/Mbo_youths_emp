from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import ScholarshipScheme
from .serializers import ScholarshipSchemeSerializer
from accounts.permissions import IsAdmin
from audit.models import AuditLog


class ScholarshipSchemeViewSet(viewsets.ModelViewSet):
    queryset = ScholarshipScheme.objects.all().order_by('-created_at')
    serializer_class = ScholarshipSchemeSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAuthenticated(), IsAdmin()]

    def get_queryset(self):
        if self.action in ['list', 'retrieve']:
            if self.request.user.is_authenticated and hasattr(self.request.user, 'role') and self.request.user.role in ['admin', 'superadmin']:
                return super().get_queryset()
            return ScholarshipScheme.objects.filter(is_published=True)
        return super().get_queryset()

    def perform_create(self, serializer):
        scheme = serializer.save()
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
        return Response({"message": "Scheme reopened successfully."})