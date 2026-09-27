from django.contrib import admin

from .models import Award, AwardAppeal, AwardEvent, AwardInstallment


class AwardInstallmentInline(admin.TabularInline):
    model = AwardInstallment
    extra = 0
    readonly_fields = ['created_at', 'updated_at']


class AwardEventInline(admin.TabularInline):
    model = AwardEvent
    extra = 0
    can_delete = False
    readonly_fields = ['actor', 'action', 'note', 'created_at']

    def has_add_permission(self, request, obj=None):
        return False  # events are written by services only


@admin.register(Award)
class AwardAdmin(admin.ModelAdmin):
    list_display = ['student', 'scheme', 'status', 'current_year_index', 'total_years',
                    'annual_amount', 'tenure_confidence', 'start_cycle']
    list_filter = ['status', 'tenure_confidence', 'scheme']
    search_fields = ['student__firstname', 'student__lastname', 'scheme__name']
    readonly_fields = ['application_id', 'created_at', 'updated_at']
    inlines = [AwardInstallmentInline, AwardEventInline]


@admin.register(AwardInstallment)
class AwardInstallmentAdmin(admin.ModelAdmin):
    list_display = ['award', 'year_index', 'cycle', 'status', 'amount',
                    'submitted_cgpa', 'threshold', 'disbursed_at']
    list_filter = ['status', 'cycle']
    search_fields = ['award__student__firstname', 'award__student__lastname']


@admin.register(AwardAppeal)
class AwardAppealAdmin(admin.ModelAdmin):
    list_display = ['award', 'installment', 'status', 'created_at', 'reviewed_by']
    list_filter = ['status']
