"""Rate throttles for unauthenticated auth endpoints.

Keyed by client IP (AnonRateThrottle). Rates are defined in
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] under the matching scope and can be
tuned via the THROTTLE_OTP / THROTTLE_AUTH environment variables.
"""
from rest_framework.throttling import AnonRateThrottle


class OTPThrottle(AnonRateThrottle):
    """Limits OTP issue/verify attempts to curb brute-force and email spam."""
    scope = 'otp'


class AuthThrottle(AnonRateThrottle):
    """Limits login / password-reset attempts."""
    scope = 'auth'
