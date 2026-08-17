from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from drf_spectacular.utils import extend_schema
from accounts.permissions import IsAdmin, IsSuperAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogPagination(PageNumberPagination):
    """100 rows per page — the frontend Audit Log table mirrors this size."""
    page_size = 100
    page_size_query_param = None


class AuditLogView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin | IsSuperAdmin]

    @extend_schema(
        summary="Audit log",
        description=(
            "Paginated record of administrative actions, 100 entries per page, "
            "newest first. Admin/superadmin only."
        ),
        responses=AuditLogSerializer(many=True),
    )
    def get(self, request):
        logs = AuditLog.objects.select_related('admin').all()
        paginator = AuditLogPagination()
        page = paginator.paginate_queryset(logs, request, view=self)
        return paginator.get_paginated_response(
            AuditLogSerializer(page, many=True).data
        )