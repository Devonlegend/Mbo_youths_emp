from django.apps import AppConfig


class ApplicationsConfig(AppConfig):
    name = 'applications'

    def ready(self):
        # Registers the unified Application projection sync receiver.
        from . import signals  # noqa: F401
