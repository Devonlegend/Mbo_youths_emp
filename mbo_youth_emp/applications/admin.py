from django.contrib import admin, messages
from django.shortcuts import redirect, render
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html

from applications.models import ApplicationStatusHistory
from applications.forms import build_application_form
from applications.services.creation import create_application
from schemes.models import ScholarshipScheme


# Applications themselves live in per-scheme tables built at runtime
# (see applications/dynamic.py). Those dynamic models cannot be registered with
# the Django admin statically. Reads happen via the API (ApplicationViewSet); for
# staff-entered applications a custom two-step page (below) routes through the
# shared create_application service. Only the status-history log is a normal,
# read-only admin model.


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    list_display  = ('application_id', 'scheme', 'from_status', 'to_status', 'changed_by', 'changed_at')
    list_filter   = ('scheme', 'to_status')
    search_fields = ('application_id', 'scheme__name')
    readonly_fields = ('application_id', 'scheme', 'from_status', 'to_status',
                       'changed_by', 'reason', 'changed_at')

    # This model's own rows are system-written; staff never add history by hand.
    def has_add_permission(self, request):
        return False

    # ── Staff "create application" flow ───────────────────────────────────────
    # Two custom views hung off this admin: pick a scheme, then fill the
    # award-type-specific form. Saving calls create_application (no emails).

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('create-application/',
                 self.admin_site.admin_view(self.pick_scheme_view),
                 name='applications_add_pick'),
            path('create-application/<uuid:scheme_id>/',
                 self.admin_site.admin_view(self.add_application_view),
                 name='applications_add_form'),
        ]
        return custom + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['create_application_url'] = reverse('admin:applications_add_pick')
        return super().changelist_view(request, extra_context)

    def pick_scheme_view(self, request):
        if not self.has_module_permission(request):
            messages.error(request, "You do not have permission to create applications.")
            return redirect('admin:index')

        scheme_id = request.GET.get('scheme')
        if scheme_id:
            return redirect('admin:applications_add_form', scheme_id=scheme_id)

        schemes = ScholarshipScheme.objects.exclude(table_name='').select_related('provider')
        ctx = {**self.admin_site.each_context(request),
               'title': 'Create application',
               'schemes': schemes}
        return TemplateResponse(request, 'admin/applications/pick_scheme.html', ctx)

    def add_application_view(self, request, scheme_id):
        if not self.has_module_permission(request):
            messages.error(request, "You do not have permission to create applications.")
            return redirect('admin:index')

        scheme = ScholarshipScheme.objects.filter(id=scheme_id).first()
        if not scheme or not scheme.table_name:
            messages.error(request, "That scheme has no application table.")
            return redirect('admin:applications_add_pick')

        form_cls = build_application_form(scheme)
        if request.method == 'POST':
            form = form_cls(request.POST)
            if form.is_valid():
                application, result = create_application(
                    scheme    = scheme,
                    student   = form.cleaned_data['student'],
                    answers   = form.answers(),
                    bank      = form.bank(),
                    self_declaration_received_support =
                        form.cleaned_data['self_declaration_received_support'],
                    self_declaration_details = form.cleaned_data['self_declaration_details'],
                    attestation_agreed = form.cleaned_data['attestation_agreed'],
                    documents          = form.cleaned_data['documents'],
                    changed_by         = request.user,
                    status_override    = form.cleaned_data['status'],
                )
                messages.success(request, format_html(
                    "Application {} created for {} (status: {}). Eligibility passed: {}.",
                    application.id, form.cleaned_data['student'],
                    application.status, result['eligible'],
                ))
                return redirect('admin:applications_applicationstatushistory_changelist')
        else:
            form = form_cls()

        ctx = {**self.admin_site.each_context(request),
               'title': f'Create application — {scheme.name}',
               'scheme': scheme,
               'form': form}
        return render(request, 'admin/applications/add_application.html', ctx)
