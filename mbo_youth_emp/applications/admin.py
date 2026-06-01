from django.contrib import admin
from applications.models import Application 
@admin.register(Application)
class adminApply(admin.ModelAdmin):
    list_display = []
    pass
    