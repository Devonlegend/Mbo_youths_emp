"""Rebuild the per-scheme (legacy) tables from the unified Application table.

During the Phase-2 write cutover the unified ``Application`` table is the source
of truth and the per-scheme tables are kept as a mirror (see
applications/services/projection.py). Run this to guarantee the legacy mirror is
complete before a rollback, or after enabling ``APPLICATIONS_WRITE_UNIFIED``.

    python manage.py sync_legacy_from_projection
"""

from django.core.management.base import BaseCommand

from applications.dynamic import iter_application_models
from applications.models import Application
from applications.services.projection import legacy_kwargs


class Command(BaseCommand):
    help = 'Mirror the unified Application table back into the per-scheme tables.'

    def handle(self, *args, **options):
        total = 0
        for scheme, model in iter_application_models():
            for application in Application.objects.filter(scheme=scheme).iterator():
                defaults = legacy_kwargs(scheme, application)
                model.objects.update_or_create(id=application.id, defaults=defaults)
                total += 1

        self.stdout.write(self.style.SUCCESS(
            f'Mirrored {total} applications back into the per-scheme tables.'))
