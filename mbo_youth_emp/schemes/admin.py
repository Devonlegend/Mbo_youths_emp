import csv
import re

from django.contrib import admin, messages
from django.http import HttpResponse
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path, reverse

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


def _stream_approved_csv(response, schemes, ward=None):
    """Stream every approved application for `schemes` as CSV.

    Reuses the same helpers as the API `approved-list` endpoint, so the admin
    exports the identical disbursement columns (name, phone, email + bank).
    When `ward` is given, only approved applicants from that ward are written.
    """
    history = (ApplicationStatusHistory.objects
               .filter(scheme__in=schemes,
                       to_status=ApplicationStatus.APPROVED))
    approved_at_map = {(h.scheme_id, h.application_id): h.changed_at
                       for h in history}

    writer = csv.writer(response)
    writer.writerow(APPROVED_LIST_CSV_FIELDNAMES)

    for scheme in schemes:
        model = get_application_model(scheme)
        qs = model.objects.filter(status=ApplicationStatus.APPROVED)
        if ward:
            qs = qs.filter(student__ward__iexact=ward)
        rows = qs.select_related('student', 'scheme').order_by('created_at')
        for index, row in enumerate(rows, start=1):
            record = serialize_approved_application(
                row, approved_at_map.get((scheme.id, row.id), row.reviewed_at))
            writer.writerow(approved_application_csv_row(index, record))
    return response


def export_approved_list(modeladmin, request, queryset):
    """Route the export through an intermediate page so staff can pick a ward."""
    scheme_ids = list(
        queryset.filter(table_name__gt='')
        .values_list('id', flat=True).distinct())
    if not scheme_ids:
        modeladmin.message_user(
            request, "No selected scheme has an application table.")
        return None
    url = reverse('admin:schemes_export_approved_list')
    return redirect(url + '?ids=' + ','.join(str(s) for s in scheme_ids))


export_approved_list.short_description = (
    "Export approved applicants for selected scheme(s) as CSV (by ward)")


@admin.register(ScholarshipScheme)
class ScholarshipSchemeAdmin(admin.ModelAdmin):
    list_display =['name','provider','award_type','eligibility_criteria','total_slots','remaining_slots']
    list_filter =['provider','award_type']
    search_fields= ['name','description']
    actions = [export_approved_list]

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('export-approved-list/',
                 self.admin_site.admin_view(self.export_approved_list_view),
                 name='schemes_export_approved_list'),
        ]
        return custom + urls

    def export_approved_list_view(self, request):
        if not self.has_module_permission(request):
            messages.error(request, "You do not have permission to export approved applicants.")
            return redirect('admin:index')

        scheme_ids = [i for i in request.GET.get('ids', '').split(',') if i]
        schemes = list(
            ScholarshipScheme.objects
            .filter(id__in=scheme_ids, table_name__gt='')
            .order_by('name'))
        if not schemes:
            messages.error(request, "No selected scheme has an application table.")
            return redirect('admin:schemes_scholarshipscheme_changelist')

        if request.method == 'POST':
            ward = request.POST.get('ward', '').strip()
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            if ward:
                slug = re.sub(r'[^A-Za-z0-9]+', '-', ward).strip('-')
                filename = f"approved-applicants-{slug}.csv"
            else:
                filename = "approved-applicants.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return _stream_approved_csv(response, schemes, ward or None)

        # GET — collect every ward that has an approved applicant across the
        # selected schemes so the form's dropdown only offers real options.
        wards = set()
        for scheme in schemes:
            model = get_application_model(scheme)
            wards.update(
                model.objects
                .filter(status=ApplicationStatus.APPROVED)
                .exclude(student__ward='')
                .values_list('student__ward', flat=True)
                .distinct())

        ctx = {**self.admin_site.each_context(request),
               'title': 'Export approved applicants',
               'schemes': schemes,
               'wards': sorted(wards)}
        return TemplateResponse(
            request, 'admin/schemes/export_approved_list.html', ctx)
