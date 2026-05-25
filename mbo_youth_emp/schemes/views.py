from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import ScholarshipScheme
from .serializers import ScholarshipSchemeSerializer
from accounts.permissions import IsAdmin


class ScholarshipSchemeViewSet(viewsets.ModelViewSet):
    queryset = ScholarshipScheme.objects.all().order_by('-created_at')
    serializer_class = ScholarshipSchemeSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAuthenticated(), IsAdmin()]

    def get_queryset(self):
        if self.action in ['list', 'retrieve']:
            return ScholarshipScheme.objects.filter(is_published=True)
        return super().get_queryset()

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        scheme = self.get_object()
        if scheme.is_published:
            return Response({"message": "Scheme is already published."}, status=status.HTTP_200_OK)
        scheme.is_published = True
        scheme.save()
        return Response({"message": "Scheme published successfully."})

    @action(detail=True, methods=['post'], url_path='close')
    def close(self, request, pk=None):
        scheme = self.get_object()
        if not scheme.is_active:
            return Response({"message": "Scheme is already closed."}, status=status.HTTP_200_OK)
        scheme.is_active = False
        scheme.save()
        return Response({"message": "Scheme closed successfully."})
