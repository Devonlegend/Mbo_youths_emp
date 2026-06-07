from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    admin_name = serializers.SerializerMethodField()

    class Meta:
        model  = AuditLog
        fields = ('id', 'admin_name', 'action', 'entity_type', 'entity_id', 'timestamp')

    def get_admin_name(self, obj):
        if obj.admin:
            return f"{obj.admin.firstname} {obj.admin.lastname}"
        return "System"