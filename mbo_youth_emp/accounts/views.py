from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.contrib.auth import get_user_model
from accounts.models import Role
from students.models import Student

from .authentication import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME

User = get_user_model()


# ──────────────────────────── cookie helpers ────────────────────────────

def _cookie_flags():
    """Resolve secure/samesite from settings, with sane DEBUG defaults."""
    secure   = getattr(settings, 'JWT_COOKIE_SECURE', not settings.DEBUG)
    samesite = getattr(settings, 'JWT_COOKIE_SAMESITE', 'Lax')
    return secure, samesite


def _set_jwt_cookies(response, refresh):
    """Attach access + refresh JWTs to the response as httpOnly cookies."""
    from rest_framework_simplejwt.settings import api_settings as jwt_settings

    secure, samesite = _cookie_flags()
    access_token = refresh.access_token

    response.set_cookie(
        ACCESS_COOKIE_NAME,
        str(access_token),
        max_age=int(jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=secure,
        samesite=samesite,
        path='/',
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        str(refresh),
        max_age=int(jwt_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=secure,
        samesite=samesite,
        path='/',
    )


def _clear_jwt_cookies(response):
    response.delete_cookie(ACCESS_COOKIE_NAME, path='/')
    response.delete_cookie(REFRESH_COOKIE_NAME, path='/')


# ──────────────────────────── endpoints ────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    POST /auth/register/
    Body: { email, firstname, lastname, phone_number, password, nin_hash,
            date_of_birth?, ward?, gender?, lga?, passport?, certificate? }

    Every registered user is also created as a Student (multi-table inheritance),
    so request.user.student_profile is always available after registration.
    On success, JWTs are set as httpOnly cookies (access_token, refresh_token).
    """
    email        = request.data.get('email')
    firstname    = request.data.get('firstname')
    lastname     = request.data.get('lastname')
    phone_number = request.data.get('phone_number')
    password     = request.data.get('password')
    date_of_birth = request.data.get('date_of_birth')
    nin_hash     = request.data.get('nin_hash')
    ward         = request.data.get('ward', '')
    gender       = request.data.get('gender')
    lga          = request.data.get('lga', '')
    passport    = request.FILES.get('passport')
    certificate = request.FILES.get('certificate')

    if not all([email, firstname, lastname, phone_number, password, nin_hash]):
        return Response({"error": "All fields are required"},
                        status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({"error": "Email already registered"},
                        status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(nin_hash=nin_hash).exists():
        return Response({"error": "NIN already in use"},
                        status=status.HTTP_400_BAD_REQUEST)

    # Every self-registered user is initially a Student. Role is forced here
    # (ignoring any client-supplied role) so privileged roles can't be claimed
    # via the public endpoint — admins promote users to other roles later.
    user = Student.objects.create_user(
        email=email,
        phone_number=phone_number,
        role=Role.STUDENT,
        password=password,
        ward=ward,
        firstname=firstname,
        lastname=lastname,
        nin_hash=nin_hash,
        date_of_birth=date_of_birth,
        gender=gender,
        lga=lga
    )

    if passport:
        user.passport = passport
    if certificate:
        user.certificate = certificate
    if passport or certificate:
        user.save()

    refresh = RefreshToken.for_user(user)

    response = Response(
        {"message": "Account created successfully", "role": user.role},
        status=status.HTTP_201_CREATED,
    )
    _set_jwt_cookies(response, refresh)
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    POST /auth/login/
    Body: { email, password }

    On success, JWTs are set as httpOnly cookies. No tokens in the JSON body.
    """
    from django.contrib.auth import authenticate

    email    = request.data.get('email')
    password = request.data.get('password')

    user = authenticate(request, username=email, password=password)
    if not user:
        return Response({"error": "Invalid email or password"},
                        status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)

    response = Response({
        "message": "Logged in",
        "role":    user.role,
        "email":   user.email,
    })
    _set_jwt_cookies(response, refresh)
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """GET /auth/me/ — who am I?"""
    return Response({
        "id":           str(request.user.id),
        "email":        request.user.email,
        "firstname":    request.user.firstname,
        "lastname":     request.user.lastname,
        "phone_number": request.user.phone_number,
        "role":         request.user.role,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    """
    POST /auth/token/refresh/
    Reads refresh_token from cookie, rotates the access cookie (and the refresh
    cookie if SimpleJWT rotation is enabled). Nothing returned in the body.
    """
    raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
    if not raw_refresh:
        return Response({"error": "Refresh token cookie missing"},
                        status=status.HTTP_401_UNAUTHORIZED)

    try:
        refresh = RefreshToken(raw_refresh)
    except (TokenError, InvalidToken):
        return Response({"error": "Invalid or expired refresh token"},
                        status=status.HTTP_401_UNAUTHORIZED)

    response = Response({"message": "Token refreshed"})
    _set_jwt_cookies(response, refresh)
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    POST /auth/logout/
    Reads refresh_token from cookie, blacklists it, clears both cookies.
    """
    raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
    if raw_refresh:
        try:
            RefreshToken(raw_refresh).blacklist()
        except TokenError:
            pass

    response = Response({"message": "Logged out successfully"})
    _clear_jwt_cookies(response)
    return response
