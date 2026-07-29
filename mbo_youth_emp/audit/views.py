from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema
from accounts.permissions import IsAdmin, IsSuperAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin | IsSuperAdmin]

    @extend_schema(
        summary="Audit log",
        description='The 100 most recent admin actions. Admin/superadmin only.',
        responses=AuditLogSerializer(many=True),
    )
    def get(self, request):
        logs = AuditLog.objects.select_related('admin').all()[:100]
        return Response(AuditLogSerializer(logs, many=True).data)