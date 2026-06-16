"""Scheme lifecycle → per-scheme application table lifecycle.

Each ScholarshipScheme owns a physical application table. Creating a scheme
creates its table; deleting a scheme drops it. See applications/dynamic.py.
"""

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import ScholarshipScheme


@receiver(post_save, sender=ScholarshipScheme)
def ensure_application_table(sender, instance, created, **kwargs):
    # table_name is always set in ScholarshipScheme.save(). Build is idempotent
    # (guarded by introspection), so running on every save is cheap and self-heals
    # a scheme whose table is somehow missing.
    if instance.table_name:
        from applications.dynamic import build_application_table
        build_application_table(instance)


@receiver(post_delete, sender=ScholarshipScheme)
def remove_application_table(sender, instance, **kwargs):
    # Dropping the table runs through schema_editor, which SQLite refuses to do
    # inside the open delete transaction. Defer it until after the commit; if the
    # delete is rolled back, on_commit never fires and the table is left intact.
    from applications.dynamic import drop_application_table
    transaction.on_commit(lambda: drop_application_table(instance))
