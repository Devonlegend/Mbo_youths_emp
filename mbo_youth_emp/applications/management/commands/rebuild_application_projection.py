"""Rebuild the unified ``Application`` table from the per-scheme tables.

Idempotent and batched (safe to run on a large live database). Run this once
before switching reads to the projection (`APPLICATIONS_USE_PROJECTION=True`),
and again any time you suspect drift (or with ``--since`` for an incremental
repair).

    python manage.py rebuild_application_projection
    python manage.py rebuild_application_projection --since 2026-09-01T00:00:00
"""

from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_datetime

from applications.dynamic import iter_application_models
from applications.models import Application
from applications.services.projection import application_kwargs

# Kept in lockstep with application_kwargs.
_UPDATE_FIELDS = [
    'student', 'scheme', 'reviewed_by', 'status', 'submission_date',
    'self_declaration_received_support', 'self_declaration_details',
    'attestation_agreed', 'attestation_at', 'documents',
    'eligibility_passed', 'eligibility_details', 'has_conflict',
    'conflict_scheme_ids', 'waiver_submitted', 'reviewed_at',
    'reviewer_notes', 'rejection_reason', 'created_at', 'updated_at',
    'bank_name', 'bank_code', 'account_number', 'account_name', 'name_match_passed',
    'institution_name', 'course_of_study', 'current_level', 'cgpa',
    'admission_year', 'matric_number',
    'trade_or_skill', 'training_provider', 'training_duration_months', 'prior_experience',
    'business_name', 'business_stage', 'business_description',
    'requested_amount', 'intended_use',
]


class Command(BaseCommand):
    help = 'Rebuild the unified Application table from the per-scheme tables.'

    def add_arguments(self, parser):
        parser.add_argument('--batch-size', type=int, default=1000,
                            help='Rows per bulk upsert (default 1000).')
        parser.add_argument('--since',
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
                batch.append(Application(**application_kwargs(scheme, row)))
                if len(batch) >= batch_size:
                    total += self._flush(batch)
                    batch = []
            if batch:
                total += self._flush(batch)

        self.stdout.write(self.style.SUCCESS(
            f'Projected {total} applications into the unified Application table.'))

    @staticmethod
    def _flush(batch):
        Application.objects.bulk_create(
            batch,
            batch_size=len(batch),
            update_conflicts=True,
            unique_fields=['id'],
            update_fields=_UPDATE_FIELDS,
        )
        return len(batch)
