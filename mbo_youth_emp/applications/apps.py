from django.apps import AppConfig


class ApplicationsConfig(AppConfig):
    name = 'applications'

    def ready(self):
        # Registers the ApplicationIndex sync receiver.
        from . import signals  # noqa: F401
