from django.contrib import admin, messages
from django.db import transaction
from django.shortcuts import redirect, render
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html

from applications.models import ApplicationStatus, ApplicationStatusHistory
from applications.forms import build_application_form
from applications.dynamic import get_application_model, iter_application_models
from applications.services.creation import create_application
from applications.services.slots import consume_slot, SlotUnavailable
from applications.services.withdrawal import withdraw_application
from schemes.models import ScholarshipScheme


# Applications themselves live in per-scheme tables built at runtime
# (see applications/dynamic.py). Those dynamic models cannot be registered with
# the Django admin statically. Reads happen via the API (ApplicationViewSet);
# staff workflows live here as custom two-step pages that route through the
# shared services:
#   * create an application              → create_application (creation.py)
#   * withdraw an approved application   → withdraw_application (withdrawal.py).
# Only the status-history log is a normal, read-only admin model.


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
            path('withdraw/',
                 self.admin_site.admin_view(self.pick_withdraw_scheme_view),
                 name='applications_withdraw_pick'),
            path('withdraw/<uuid:scheme_id>/',
                 self.admin_site.admin_view(self.withdraw_applications_view),
                 name='applications_withdraw_form'),
        ]
        return custom + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['create_application_url'] = reverse('admin:applications_add_pick')
        extra_context['withdraw_application_url'] = reverse('admin:applications_withdraw_pick')
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
                student      = form.cleaned_data['student']
                final_status = form.cleaned_data['status']
                try:
                    with transaction.atomic():
                        application, result = create_application(
                            scheme    = scheme,
                            student   = student,
                            answers   = form.answers(),
                            bank      = form.bank(),
                            self_declaration_received_support =
                                form.cleaned_data['self_declaration_received_support'],
                            self_declaration_details = form.cleaned_data['self_declaration_details'],
                            attestation_agreed = form.cleaned_data['attestation_agreed'],
                            documents          = form.cleaned_data['documents'],
                            changed_by         = request.user,
                            status_override    = final_status,
                        )
                        # Admin-created approvals consume a slot too, so they
                        # respect the scheme cap just like the verifier review.
                        if final_status == ApplicationStatus.APPROVED:
                            if not consume_slot(scheme):
                                raise SlotUnavailable(
                                    "No slots remaining — cannot approve.")
                            student.active_award = scheme.name
                            student.save(update_fields=['active_award'])
                except SlotUnavailable:
                    # Nothing was committed (the whole block rolled back), so we
                    # just report the failure and let the staff fix the status.
                    messages.error(
                        request,
                        "Cannot create an approved application: no slots remaining for this scheme.",
                    )
                else:
                    messages.success(request, format_html(
                        "Application {} created for {} (status: {}). Eligibility passed: {}.",
                        application.id, student,
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
    # ── Staff "withdraw award" flow ─────────────────────────────────────────
    # Two-step flow mirroring the create-application pages: pick a scheme that
    # has approved applications, then withdraw a specific one. Withdrawing
    # releases the scheme slot via the shared withdrawal service.

    def pick_withdraw_scheme_view(self, request):
        if not self.has_module_permission(request):
            messages.error(request, "You do not have permission to withdraw applications.")
            return redirect('admin:index')

        schemes = []
        for scheme, model in iter_application_models():
            approved = model.objects.filter(status=ApplicationStatus.APPROVED).count()
            if approved:
                schemes.append({'scheme': scheme, 'approved_count': approved})

        ctx = {**self.admin_site.each_context(request),
               'title': 'Withdraw application',
               'schemes': schemes}
        return TemplateResponse(request, 'admin/applications/withdraw_scheme.html', ctx)

    def withdraw_applications_view(self, request, scheme_id):
        if not self.has_module_permission(request):
            messages.error(request, "You do not have permission to withdraw applications.")
            return redirect('admin:index')

        scheme = ScholarshipScheme.objects.filter(id=scheme_id).first()
        if not scheme or not scheme.table_name:
            messages.error(request, "That scheme has no application table.")
            return redirect('admin:applications_withdraw_pick')

        model = get_application_model(scheme)

        if request.method == 'POST':
            # POST/Redirect/GET: handle the action then bounce back to the list
            # so a browser refresh can't withdraw the same award twice.
            try:
                application = model.objects.filter(
                    id=request.POST.get('application_id'),
                    status=ApplicationStatus.APPROVED,
                ).first()
            except Exception:
                application = None

            if application is None:
                messages.error(request, "Application not found or no longer approved.")
            else:
                try:
                    withdrawn_app, remaining = withdraw_application(
                        application, scheme, request.user)
                    messages.success(request, format_html(
                        "Withdrawn application {} — slot released ({} remaining).",
                        withdrawn_app.id, remaining,
                    ))
                except Exception:
                    messages.error(request, "Failed to withdraw the application.")
            return redirect('admin:applications_withdraw_form', scheme_id=scheme_id)

        applications = model.objects.filter(
            status=ApplicationStatus.APPROVED,
        ).select_related('student__user', 'scheme')

        ctx = {**self.admin_site.each_context(request),
               'title': f'Withdraw application — {scheme.name}',
               'scheme': scheme,
               'applications': applications}
        return TemplateResponse(
            request, 'admin/applications/withdraw_applications.html', ctx)

