from django.contrib import admin

from . import models 

# Register you@r models here.
from audit.models import AuditLog
admin.site.register(AuditLog)

@admin.register(models.User)
class UserAdmin(admin.ModelAdmin):
    pass