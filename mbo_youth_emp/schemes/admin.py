from django.contrib import admin
from .models import Cycle, SchemeProvider, ScholarshipScheme


@admin.register(Cycle)
class CycleAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_year', 'end_year', 'is_active']
    list_filter = ['is_active']
    list_editable = ['is_active']
    search_fields = ['name']


@admin.register(SchemeProvider)
class SchemeAdmin(admin.ModelAdmin):
    list_display =['name','provider_type']
    search_fields = ['name','provider_type']

@admin.register(ScholarshipScheme)
class ScholarshipSchemeAdmin(admin.ModelAdmin):
    list_display =['name','provider','award_type','eligibility_criteria','total_slots','remaining_slots']
    list_filter =['provider','award_type']
    search_fields= ['name','description']