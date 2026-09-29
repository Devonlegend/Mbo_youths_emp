"""Fire-and-forget email dispatch for award events.

Emails are enqueued on ``transaction.on_commit`` so a state change never
blocks on the broker, and a broker/network failure can never turn a committed
transition into a 500.
"""

import logging

from django.db import transaction

logger = logging.getLogger(__name__)


def dispatch_email(task, **kwargs):
    """Enqueue ``task`` after the current transaction commits (no-op if there
    is no open transaction — on_commit runs immediately then)."""
    def _enqueue():
        try:
            task.delay(**kwargs)
        except Exception:
            logger.exception('Failed to enqueue %s', getattr(task, 'name', task))

    transaction.on_commit(_enqueue)
