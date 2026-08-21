from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only view of the immutable audit trail.

    Every row is produced by ``audit.services.record_admin_action``; entries
    must never be created, edited or deleted from the admin, so all fields are
    read-only and add/delete are disabled. Staff can only browse/filter/search.
    """

    list_display = ['admin_name', 'action', 'entity_type', 'entity_id', 'timestamp']
    list_filter  = ['entity_type', 'timestamp']
    search_fields = [
        'action',
        'entity_id',
        'admin__firstname',
        'admin__lastname',
        'admin__email',
    ]
    date_hierarchy     = 'timestamp'
    ordering           = ['-timestamp']
    readonly_fields    = ['id', 'admin', 'action', 'entity_type', 'entity_id', 'timestamp']
    list_select_related = ['admin']
    list_per_page      = 100

    @admin.display(ordering='admin__firstname', description='Admin')
    def admin_name(self, obj):
        return obj.admin.full_name if obj.admin else 'System'

    # ── Immutability guards ──────────────────────────────────────────────────
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

