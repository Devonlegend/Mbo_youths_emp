"""Signal wiring for the applications app.

The ``ApplicationStatusHistory`` model is the single chokepoint every status
transition passes through, so a post-save receiver there keeps the unified
``Application`` table in sync without instrumenting each write path.

The sync is best-effort: a projection failure must never roll back (or 500) the
application write. Drift is repairable with
``manage.py rebuild_application_projection``.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ApplicationStatusHistory
from .services.projection import upsert_application

logger = logging.getLogger(__name__)


@receiver(post_save, sender=ApplicationStatusHistory,
          dispatch_uid='applications.sync_application_projection')
def sync_application_projection(sender, instance, **kwargs):
    try:
        upsert_application(instance.scheme, instance.application_id)
    except Exception:
        logger.exception(
            "Failed to sync Application projection for %s",
            instance.application_id,
        )
