import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.contrib.auth import get_user_model
from accounts.models import EmailOTP, PasswordResetOTP, Role
from students.models import Student

from .authentication import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from .services import ApiException, send_otp_email, send_password_reset_email

User = get_user_model()
logger = logging.getLogger(__name__)


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
    # User and Student are created together in a transaction so the registered
    # user always has a matching student row keyed by the same UUID.
    with transaction.atomic():
        user = User.objects.create_user(
            email=email,
            phone_number=phone_number,
            role=Role.STUDENT,
            password=password,
            firstname=firstname,
            lastname=lastname,
            nin_hash=nin_hash,
            date_of_birth=date_of_birth,
            gender=gender,
        )
        Student.objects.create(
            user=user,
            firstname=firstname,
            lastname=lastname,
            ward=ward or '',
            lga=lga or '',
            date_of_birth=date_of_birth,
            nin_hash=nin_hash,
            passport=passport,
            certificate=certificate
        )

    # No JWT cookies here — the client must complete the OTP flow
    # (/auth/otp/send/ → /auth/otp/verify/) before being logged in.
    return Response(
        {"message": "Account created. Please verify your email.", "email": user.email},
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    POST /auth/login/
    Body: { email, password }

    Validates credentials but does NOT issue JWTs. The client must then call
    /auth/otp/send/ and /auth/otp/verify/ to receive httpOnly cookies.
    """
    from django.contrib.auth import authenticate

    email    = request.data.get('email')
    password = request.data.get('password')

    user = authenticate(request, username=email, password=password)
    if not user:
        return Response({"error": "Invalid email or password"},
                        status=status.HTTP_401_UNAUTHORIZED)

    return Response({"otp_required": True, "email": user.email})


# ──────────────────────────── OTP ────────────────────────────

def _generate_code() -> str:
    """Cryptographically-random 6-digit code, zero-padded."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _issue_otp(email):
    """Generate a fresh OTP for `email`, invalidate prior unused ones, and email
    it via Brevo. Returns a tuple (response_payload, http_status). Caller is
    responsible only for wrapping in a Response."""
    email = (email or '').strip().lower()
    if not email:
        return {"error": "Email is required"}, status.HTTP_400_BAD_REQUEST

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        # Don't disclose whether the email exists.
        return {"error": "Unable to send OTP"}, status.HTTP_400_BAD_REQUEST

    now = timezone.now()

    latest = (
        EmailOTP.objects
        .filter(email__iexact=user.email)
        .order_by('-created_at')
        .first()
    )
    if (
        latest is not None
        and latest.used_at is None
        and (now - latest.created_at).total_seconds() < settings.OTP_RESEND_COOLDOWN_SECONDS
    ):
        retry_after = int(
            settings.OTP_RESEND_COOLDOWN_SECONDS
            - (now - latest.created_at).total_seconds()
        ) + 1
        return (
            {"error": "Please wait before requesting another code.",
             "retry_after_seconds": retry_after},
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    code = _generate_code()
    with transaction.atomic():
        EmailOTP.objects.filter(email__iexact=user.email, used_at__isnull=True).update(used_at=now)
        EmailOTP.objects.create(
            email=user.email,
            code=code,
            expires_at=now + timedelta(seconds=settings.OTP_TTL_SECONDS),
        )

    try:
        send_otp_email(user.email, code)
    except ApiException:
        logger.exception("Brevo send_transac_email failed for %s", user.email)
        return {"error": "Failed to send OTP email"}, status.HTTP_502_BAD_GATEWAY
    except Exception:
        logger.exception("Unexpected error sending OTP email to %s", user.email)
        return {"error": "Failed to send OTP email"}, status.HTTP_502_BAD_GATEWAY

    return None, status.HTTP_200_OK


@api_view(['POST'])
@permission_classes([AllowAny])
def otp_send(request):
    """POST /auth/otp/send/  Body: { email }"""
    payload, http_status = _issue_otp(request.data.get('email'))
    if payload is not None:
        return Response(payload, status=http_status)
    return Response({"message": "OTP sent"})


@api_view(['POST'])
@permission_classes([AllowAny])
def otp_resend(request):
    """POST /auth/otp/resend/  Body: { email }"""
    payload, http_status = _issue_otp(request.data.get('email'))
    if payload is not None:
        return Response(payload, status=http_status)
    return Response({"message": "OTP resent"})


@api_view(['POST'])
@permission_classes([AllowAny])
def otp_verify(request):
    """
    POST /auth/otp/verify/  Body: { email, code }

    On success: marks the user as email-verified and sets httpOnly JWT cookies.
    """
    email = (request.data.get('email') or '').strip().lower()
    code  = (request.data.get('code')  or '').strip()

    if not email or not code:
        return Response({"error": "Email and code are required"},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response({"error": "Invalid or expired code"},
                        status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    otp = (
        EmailOTP.objects
        .filter(email__iexact=user.email, used_at__isnull=True, expires_at__gt=now)
        .order_by('-created_at')
        .first()
    )
    if otp is None:
        return Response({"error": "Invalid or expired code"},
                        status=status.HTTP_400_BAD_REQUEST)

    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        EmailOTP.objects.filter(pk=otp.pk, used_at__isnull=True).update(used_at=now)
        return Response({"error": "Too many attempts. Request a new code."},
                        status=status.HTTP_429_TOO_MANY_REQUESTS)

    # Atomic increment so concurrent verify attempts can't race past the cap.
    EmailOTP.objects.filter(pk=otp.pk).update(attempts=F('attempts') + 1)

    if not secrets.compare_digest(otp.code, code):
        return Response({"error": "Invalid or expired code"},
                        status=status.HTTP_400_BAD_REQUEST)

    EmailOTP.objects.filter(pk=otp.pk, used_at__isnull=True).update(used_at=now)

    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=['email_verified'])

    refresh = RefreshToken.for_user(user)
    response = Response({"message": "Verified"})
    _set_jwt_cookies(response, refresh)
    return response


# ──────────────────────────── identity ────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """GET /auth/me/ — who am I?"""
    return Response({
        "id":           str(request.user.id),
        "email":        request.user.email,
        "passport":     request.user.passport,
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


# ──────────────────────────── password reset ────────────────────────────

# Generic message returned by request/verify/confirm so an attacker can't probe
# which emails are registered.
_RESET_GENERIC_OK = {"message": "If that email is registered, a reset code has been sent."}


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    """
    POST /auth/password/reset/request/  Body: { email }

    Always returns 200, regardless of whether the email is registered, so the
    endpoint can't be used to enumerate accounts.
    """
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        # Even bad input gets the generic response — no info leak.
        return Response(_RESET_GENERIC_OK)

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response(_RESET_GENERIC_OK)

    now = timezone.now()

    # Soft cooldown: if a live OTP was issued within the cooldown window, skip
    # issuing/sending another. Still respond 200 so existence isn't disclosed.
    latest = (
        PasswordResetOTP.objects
        .filter(email__iexact=user.email, expires_at__gt=now)
        .order_by('-created_at')
        .first()
    )
    if latest is not None and (
        (now - latest.created_at).total_seconds() < settings.OTP_RESEND_COOLDOWN_SECONDS
    ):
        return Response(_RESET_GENERIC_OK)

    code = _generate_code()
    with transaction.atomic():
        # Invalidate any earlier reset codes for this email so only the newest works.
        PasswordResetOTP.objects.filter(email__iexact=user.email).delete()
        PasswordResetOTP.objects.create(
            email=user.email,
            code=code,
            expires_at=now + timedelta(seconds=settings.OTP_TTL_SECONDS),
        )

    try:
        send_password_reset_email(user.email, code)
    except ApiException:
        logger.exception("Brevo send_password_reset_email failed for %s", user.email)
    except Exception:
        logger.exception("Unexpected error sending password reset email to %s", user.email)

    return Response(_RESET_GENERIC_OK)


def _find_valid_reset_otp(email, code):
    """Return the matching, unexpired, under-attempt-cap OTP, incrementing the
    attempt counter on every lookup. Returns (otp, error_payload, status_code).
    Exactly one of otp / error_payload is non-None."""
    email = (email or '').strip().lower()
    code = (code or '').strip()
    if not email or not code:
        return None, {"error": "Email and code are required"}, status.HTTP_400_BAD_REQUEST

    now = timezone.now()
    otp = (
        PasswordResetOTP.objects
        .filter(email__iexact=email, expires_at__gt=now)
        .order_by('-created_at')
        .first()
    )
    if otp is None:
        return None, {"error": "Invalid or expired code"}, status.HTTP_400_BAD_REQUEST

    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        # Burn the code so brute-forcing has to start over.
        PasswordResetOTP.objects.filter(pk=otp.pk).delete()
        return None, {"error": "Too many attempts. Request a new code."}, status.HTTP_429_TOO_MANY_REQUESTS

    PasswordResetOTP.objects.filter(pk=otp.pk).update(attempts=F('attempts') + 1)

    if not secrets.compare_digest(otp.code, code):
        return None, {"error": "Invalid or expired code"}, status.HTTP_400_BAD_REQUEST

    return otp, None, status.HTTP_200_OK


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_verify(request):
    """
    POST /auth/password/reset/verify/  Body: { email, code }

    Validates the OTP without consuming it — the client uses this to gate the
    "enter new password" step before calling confirm.
    """
    otp, err, http_status = _find_valid_reset_otp(
        request.data.get('email'), request.data.get('code')
    )
    if err is not None:
        return Response(err, status=http_status)
    return Response({"message": "Code verified"})


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    """
    POST /auth/password/reset/confirm/  Body: { email, code, new_password }

    Re-validates the OTP, sets the new password, deletes the OTP, and blacklists
    every outstanding refresh token for the user so existing sessions are
    invalidated.
    """
    email = (request.data.get('email') or '').strip().lower()
    new_password = request.data.get('new_password') or ''

    if not new_password:
        return Response({"error": "new_password is required"},
                        status=status.HTTP_400_BAD_REQUEST)

    otp, err, http_status = _find_valid_reset_otp(email, request.data.get('code'))
    if err is not None:
        return Response(err, status=http_status)

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response({"error": "Invalid or expired code"},
                        status=status.HTTP_400_BAD_REQUEST)

    # SimpleJWT's blacklist app tracks every refresh token issued. Blacklisting
    # all outstanding ones forces every other session to fail on next refresh.
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

    with transaction.atomic():
        user.set_password(new_password)
        user.save(update_fields=['password'])
        PasswordResetOTP.objects.filter(email__iexact=user.email).delete()
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)

    response = Response({"message": "Password has been reset. Please log in."})
    # Also clear cookies on this response in case the caller was logged in.
    _clear_jwt_cookies(response)
    return response
