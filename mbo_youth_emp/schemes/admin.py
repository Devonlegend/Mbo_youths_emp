from django.contrib import admin
from .models import SchemeProvider ,ScholarshipScheme
@admin.register(SchemeProvider)
class SchemeAdmin(admin.ModelAdmin):
    list_display =['name','provider_type']
    search_fields = ['name','provider_type']

@admin.register(ScholarshipScheme)
class ScholarshipSchemeAdmin(admin.ModelAdmin):
    list_display =['name','provider','award_type','eligibility_criteria','total_slots','remaining_slots']
    list_filter =['provider','award_type']
    search_fields= ['name','description']