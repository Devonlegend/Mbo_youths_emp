from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import ScholarshipScheme, Cycle
from .serializers import ScholarshipSchemeSerializer, CycleSerializer
from accounts.permissions import IsAdmin


# ── Cycle ViewSet ─────────────────────────────────────────────────────────────

class CycleViewSet(viewsets.ModelViewSet):
    """
    CRUD for programme cycles.
    Admin-only for write operations; anyone can read.
    """
    queryset           = Cycle.objects.all().order_by('-start_year')
    serializer_class   = CycleSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAdmin()]

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        """POST /schemes/cycles/{id}/activate/ — make this the active cycle."""
        # Deactivate all others first
        Cycle.objects.all().update(is_active=False)
        cycle = self.get_object()
        cycle.is_active = True
        cycle.save()
        return Response({'status': 'Cycle activated', 'cycle': CycleSerializer(cycle).data})


# ── ScholarshipScheme ViewSet ─────────────────────────────────────────────────

class ScholarshipSchemeViewSet(viewsets.ModelViewSet):
    queryset           = ScholarshipScheme.objects.all().order_by('-created_at')
    serializer_class   = ScholarshipSchemeSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAdmin()]

    def get_queryset(self):
        queryset = ScholarshipScheme.objects.select_related(
            'provider', 'cycle'
        ).order_by('-created_at')

        user = self.request.user
        is_admin = user and user.is_authenticated and user.role in ['admin', 'superadmin']

        # Non-admins only see published + active schemes
        if not is_admin:
            queryset = queryset.filter(is_published=True, is_active=True)

        # Filter by award_type
        award_type = self.request.query_params.get('award_type')
        if award_type:
            queryset = queryset.filter(award_type=award_type)

        # Filter by cycle — 'active' means the currently active cycle
        cycle_param = self.request.query_params.get('cycle')
        if cycle_param == 'active':
            active_cycle = Cycle.get_active()
            if active_cycle:
                queryset = queryset.filter(cycle=active_cycle)
        elif cycle_param:
            queryset = queryset.filter(cycle__id=cycle_param)

        return queryset

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """POST /schemes/{id}/publish/"""
        scheme = self.get_object()
        scheme.is_published = True
        scheme.is_active    = True
        scheme.save()
        return Response({
            'status': 'scheme published successfully',
            'is_published': scheme.is_published,
            'is_active': scheme.is_active
        })

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """POST /schemes/{id}/close/"""
        scheme = self.get_object()
        scheme.is_active = False
        scheme.save()
        return Response({
            'status': 'scheme closed successfully',
            'is_active': scheme.is_active
        })
