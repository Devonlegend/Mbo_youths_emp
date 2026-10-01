"""Rebuild the cross-scheme ``ApplicationIndex`` read model.

Idempotent and batched (safe to run on a large live database). Run this once
before flipping ``APPLICATIONS_USE_INDEX`` on, and again any time you suspect
the projection has drifted (or with ``--since`` for an incremental repair).

    python manage.py rebuild_application_index
    python manage.py rebuild_application_index --since 2026-09-01T00:00:00
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from applications.dynamic import iter_application_models
from applications.models import ApplicationIndex
from applications.services.index import index_kwargs

# Kept in lockstep with the ApplicationIndex fields written by the sync signal.
_UPDATE_FIELDS = [
    'scheme', 'student', 'status', 'submission_date',
    'eligibility_passed', 'has_conflict', 'waiver_submitted',
    'created_at', 'indexed_at',
]


class Command(BaseCommand):
    help = 'Rebuild the ApplicationIndex read model from the per-scheme tables.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size', type=int, default=1000,
            help='Rows per bulk upsert (default 1000).')
        parser.add_argument(
            '--since',
            help='ISO-8601 datetime; only reindex rows with updated_at >= this.')

    def handle(self, *args, **options):
        since = None
        if options['since']:
            since = parse_datetime(options['since'])
            if since is None:
                self.stderr.write(self.style.ERROR(
                    f"Could not parse --since '{options['since']}' as ISO-8601."))
                return

        batch_size = options['batch_size']
        total = 0

        for scheme, model in iter_application_models():
            qs = model.objects.all()
            if since is not None:
                qs = qs.filter(updated_at__gte=since)

            batch = []
            for row in qs.iterator(chunk_size=batch_size):
                batch.append(ApplicationIndex(**index_kwargs(scheme, row)))
                if len(batch) >= batch_size:
                    total += self._flush(batch)
                    batch = []
            if batch:
                total += self._flush(batch)

        self.stdout.write(self.style.SUCCESS(
            f'Indexed {total} applications into ApplicationIndex.'))

    @staticmethod
    def _flush(batch):
        ApplicationIndex.objects.bulk_create(
            batch,
            batch_size=len(batch),
            update_conflicts=True,
            unique_fields=['application_id'],
            update_fields=_UPDATE_FIELDS,
        )
        return len(batch)
