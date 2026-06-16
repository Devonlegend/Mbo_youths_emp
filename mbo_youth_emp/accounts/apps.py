from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = 'accounts'

    def ready(self):
        # Register the drf-spectacular auth extension for CookieJWTAuthentication
        # so the generated OpenAPI schema advertises the cookie security scheme.
        from . import schema  # noqa: F401
