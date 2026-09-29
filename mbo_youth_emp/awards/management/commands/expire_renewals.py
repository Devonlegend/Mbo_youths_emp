"""Run the recurring-scholarship timers.

Deployment dependency: this only fires if it is actually scheduled (cron /
Task Scheduler / django-celery-beat). Without it, non-submission never
suspends and appeal windows never expire.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from awards.services.expiry import expire_appeals, expire_overdue_renewals


class Command(BaseCommand):
    help = ('Cancel overdue renewals (suspend awards) and expire lapsed appeal '
            'windows (terminate awards). Intended to run on a schedule.')

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would change without writing.')

    def handle(self, *args, **options):
        if options['dry_run']:
            with transaction.atomic():
                renewals = expire_overdue_renewals()
                appeals = expire_appeals()
                transaction.set_rollback(True)
            self.stdout.write(self.style.WARNING('DRY RUN — nothing written.'))
        else:
            renewals = expire_overdue_renewals()
            appeals = expire_appeals()

        self.stdout.write(self.style.SUCCESS(
            f"Renewals cancelled: {renewals['cancelled']} "
            f"(awards suspended: {renewals['suspended']}); "
            f"appeal windows expired: {appeals['terminated']}"))
