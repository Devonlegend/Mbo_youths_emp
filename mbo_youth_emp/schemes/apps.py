from django.apps import AppConfig


class SchemesConfig(AppConfig):
    name = 'schemes'

    def ready(self):
        # Wire the post_save/post_delete handlers that create/drop each scheme's
        # dedicated application table.
        from . import signals  # noqa: F401
