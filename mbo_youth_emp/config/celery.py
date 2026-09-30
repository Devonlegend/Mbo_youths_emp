import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# ── Periodic jobs ──────────────────────────────────────────────────────────
# Static, version-controlled schedule. `beat` runs as its own service in
# docker-compose.yml; do NOT run it inside the worker container (you'd get two
# schedulers). Times are UTC. The same work is still runnable by hand via
# `python manage.py expire_renewals` (and `--dry-run`).
app.conf.timezone = 'UTC'
app.conf.beat_schedule = {
    # Cancels overdue renewals (suspends awards) and expires lapsed appeal
    # windows (terminates awards). Daily is ample for the multi-week windows.
    'expire-recurring-renewals': {
        'task':     'awards.tasks.expire_awards',
        'schedule': crontab(minute=0, hour=1),  # 01:00 UTC every day
    },
}
