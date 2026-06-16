"""Rebuild the per-scheme application tables.

Each ``schemes.ScholarshipScheme`` owns a physical table whose shape is defined in
``applications/dynamic.py``. When that shape changes there is no migration to run —
the tables are ``managed = False`` — so they must be rebuilt from the current
field definitions.

Usage:
    manage.py rebuild_application_tables               # drop + recreate every table
    manage.py rebuild_application_tables --missing-only # only create absent tables
    manage.py rebuild_application_tables --scheme <id>  # restrict to one scheme

A full rebuild DROPS the tables and therefore destroys every application row in
them. It refuses to run without ``--yes`` (or an interactive confirmation).
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from schemes.models import ScholarshipScheme
from applications import dynamic


class Command(BaseCommand):
    help = "Drop and recreate the per-scheme application tables from dynamic.py."

    def add_arguments(self, parser):
        parser.add_argument(
            '--missing-only', action='store_true',
            help="Only create tables that do not exist yet; never drop. Non-destructive.",
        )
        parser.add_argument(
            '--scheme', metavar='ID',
            help="Restrict to a single scheme id.",
        )
        parser.add_argument(
            '--yes', action='store_true',
            help="Skip the destructive-action confirmation prompt.",
        )

    def handle(self, *args, **options):
        missing_only = options['missing_only']
        scheme_id    = options['scheme']
        assume_yes   = options['yes']

        schemes = ScholarshipScheme.objects.exclude(table_name='')
        if scheme_id:
            schemes = schemes.filter(id=scheme_id)
        schemes = list(schemes)

        if not schemes:
            raise CommandError(
                "No schemes with a table_name found"
                + (f" for id {scheme_id}." if scheme_id else ".")
            )

        if not missing_only and not assume_yes:
            self.stdout.write(self.style.WARNING(
                f"This will DROP and recreate {len(schemes)} table(s), "
                "destroying all application rows in them."
            ))
            try:
                confirm = input("Type 'yes' to continue: ")
            except EOFError:
                raise CommandError("Aborted — no confirmation given (use --yes to skip the prompt).")
            if confirm.strip().lower() != 'yes':
                raise CommandError("Aborted.")

        # Shape may have changed since these classes were first built this process;
        # clear the memo so fresh classes are constructed from current dynamic.py.
        dynamic._MODEL_CACHE.clear()

        existing = set(connection.introspection.table_names())
        created = dropped = skipped = 0

        for scheme in schemes:
            present = scheme.table_name in existing

            if missing_only:
                if present:
                    skipped += 1
                    self.stdout.write(f"  skip   {scheme.table_name}  ({scheme.name})")
                    continue
                dynamic.build_application_table(scheme)
                created += 1
                self.stdout.write(self.style.SUCCESS(
                    f"  create {scheme.table_name}  ({scheme.name})"))
                continue

            # Full rebuild: drop if present, then create fresh.
            if present:
                dynamic.drop_application_table(scheme)
                dropped += 1
            dynamic.build_application_table(scheme)
            created += 1
            self.stdout.write(self.style.SUCCESS(
                f"  rebuild {scheme.table_name}  ({scheme.name})"))

        self.stdout.write(self.style.SUCCESS(
            f"Done. created={created} dropped={dropped} skipped={skipped}"))
