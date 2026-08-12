import csv

from django.contrib import admin
from django.http import HttpResponse

from .models import Cycle, SchemeProvider, ScholarshipScheme
from applications.dynamic import get_application_model
from applications.models import ApplicationStatus, ApplicationStatusHistory
from applications.serializers import (
    APPROVED_LIST_CSV_FIELDNAMES,
    approved_application_csv_row,
    serialize_approved_application,
)


@admin.register(Cycle)
class CycleAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_year', 'end_year', 'is_active']
    list_filter = ['is_active']
    list_editable = ['is_active']
    search_fields = ['name']


@admin.register(SchemeProvider)
class SchemeAdmin(admin.ModelAdmin):
    list_display = ['name', 'provider_type']
    search_fields = ['name', 'provider_type']


def export_approved_list(modeladmin, request, queryset):
    """Stream every approved application for the selected scheme(s) as CSV.

    Reuses the same helpers as the API `approved-list` endpoint, so the admin
    exports the identical disbursement columns (name, phone, email + bank).
    """
    schemes = list(queryset.filter(table_name__gt='').distinct())
    if not schemes:
        modeladmin.message_user(
            request, "No selected scheme has an application table.")
        return None

    history = (ApplicationStatusHistory.objects
               .filter(scheme__in=schemes,
                       to_status=ApplicationStatus.APPROVED))
    approved_at_map = {(h.scheme_id, h.application_id): h.changed_at
                       for h in history}

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="approved-applicants.csv"'
    writer = csv.writer(response)
    writer.writerow(APPROVED_LIST_CSV_FIELDNAMES)

    for scheme in schemes:
        model = get_application_model(scheme)
        rows = (model.objects
                .filter(status=ApplicationStatus.APPROVED)
                .select_related('student', 'scheme')
                .order_by('created_at'))
        for index, row in enumerate(rows, start=1):
            record = serialize_approved_application(
                row, approved_at_map.get((scheme.id, row.id), row.reviewed_at))
            writer.writerow(approved_application_csv_row(index, record))
    return response


export_approved_list.short_description = (
    "Export approved applicants for selected scheme(s) as CSV")


@admin.register(ScholarshipScheme)
class ScholarshipSchemeAdmin(admin.ModelAdmin):
    list_display =['name','provider','award_type','eligibility_criteria','total_slots','remaining_slots']
    list_filter =['provider','award_type']
    search_fields= ['name','description']
    actions = [export_approved_list]
