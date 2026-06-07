from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAdmin, IsSuperAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin | IsSuperAdmin]

    def get(self, request):
        logs = AuditLog.objects.select_related('admin').all()[:100]
        return Response(AuditLogSerializer(logs, many=True).data)