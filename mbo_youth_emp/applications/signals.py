"""Signal wiring for the applications app.

The ``ApplicationStatusHistory`` model is the single chokepoint every status
transition passes through, so a post-save receiver there keeps the cross-scheme
``ApplicationIndex`` read model in sync without instrumenting each write path.

The sync is best-effort: a projection failure must never roll back (or 500) the
application write. Drift is repairable with ``manage.py rebuild_application_index``.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ApplicationStatusHistory
from .services.index import upsert_application_index

logger = logging.getLogger(__name__)


@receiver(post_save, sender=ApplicationStatusHistory,
          dispatch_uid='applications.sync_application_index')
def sync_application_index(sender, instance, **kwargs):
    try:
        upsert_application_index(instance.scheme, instance.application_id)
    except Exception:
        logger.exception(
            "Failed to sync ApplicationIndex for application %s",
            instance.application_id,
        )
