from rest_framework_simplejwt.authentication import JWTAuthentication


ACCESS_COOKIE_NAME  = 'access_token'
REFRESH_COOKIE_NAME = 'refresh_token'


class CookieJWTAuthentication(JWTAuthentication):
    """
    Reads the JWT access token from an httpOnly cookie. Falls back to the
    Authorization header so server-to-server tooling (curl, Postman) still works.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            raw_token = request.COOKIES.get(ACCESS_COOKIE_NAME)

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
