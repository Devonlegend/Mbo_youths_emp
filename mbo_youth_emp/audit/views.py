from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema_view, extend_schema
from accounts.permissions import IsAdmin, IsSuperAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogPagination(PageNumberPagination):
    page_size = 100  


@extend_schema_view(
    get=extend_schema(
        summary="Audit log",
        description="Paginated admin actions, newest first. Admin/superadmin only.",
        responses=AuditLogSerializer(many=True),
    )
)
class AuditLogView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin | IsSuperAdmin]
    serializer_class   = AuditLogSerializer
    pagination_class    = AuditLogPagination
    queryset            = AuditLog.objects.select_related('admin').all()