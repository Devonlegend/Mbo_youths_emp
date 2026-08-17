"""
Failure-safe audit-log helpers.

Admin-facing views call :func:`record_admin_action` to append an immutable
``AuditLog`` row for every significant administrative action. The helper is
deliberately side-effect tolerant: a logging failure must never break (or roll
back) the admin action that triggered it, so every write is wrapped in a
try/except and logged as an error instead of being re-raised.
"""

import logging

from .models import AuditLog

logger = logging.getLogger(__name__)


def record_admin_action(admin, action, entity_type, entity_id=''):
    """Append one row to the audit log.

    Args:
        admin:       The authenticated user performing the action. May be
                     ``None`` (or any non-authenticated object) for system-level
                     events — the row is then shown as "System".
        action:      Human-readable description of what happened,
                     e.g. ``"Application approved"``.
        entity_type: Stable type name used by the UI filter chips —
                     ``Application``, ``Student``, ``Scheme``, ``Cycle``,
                     ``SchemeProvider`` or ``System``.
        entity_id:   Optional id of the affected record.

    Never raises.
    """
    user = admin if getattr(admin, 'is_authenticated', False) else None
    try:
        AuditLog.objects.create(
            admin       = user,
            action      = action,
            entity_type = entity_type or 'System',
            entity_id   = str(entity_id) if entity_id else '',
        )
    except Exception:
        logger.exception(
            "Failed to write audit log entry for %s (%s)",
            entity_type or 'System', entity_id or '',
        )
