"""drf-spectacular integration helpers for the accounts app.

The project authenticates with a custom ``CookieJWTAuthentication`` that reads
the JWT from an httpOnly ``access_token`` cookie. drf-spectacular doesn't know
how to describe a custom auth class on its own, so we register an extension that
tells the generated OpenAPI schema to advertise an ``apiKey`` security scheme
bound to that cookie. Without this the Swagger UI "Authorize" section is empty.

The extension is discovered automatically by drf-spectacular as long as this
module is imported at startup — see ``AccountsConfig.ready()`` in apps.py.
"""

from drf_spectacular.extensions import OpenApiAuthenticationExtension

from .authentication import ACCESS_COOKIE_NAME


class CookieJWTScheme(OpenApiAuthenticationExtension):
    target_class = 'accounts.authentication.CookieJWTAuthentication'
    name = 'cookieAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'cookie',
            'name': ACCESS_COOKIE_NAME,
            'description': (
                'JWT access token stored in an httpOnly cookie. Obtained via the '
                'login + OTP flow (POST /auth/login/ then /auth/otp/verify/). '
                'Browsers send it automatically; for tooling you may instead pass '
                '`Authorization: Bearer <token>`.'
            ),
        }
