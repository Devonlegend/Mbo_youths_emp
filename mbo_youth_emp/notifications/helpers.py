"""Notification factory helpers.

Each function creates a Notification row so the student or staff member sees
it in the /notifications/ endpoint and the frontend bell icon. Every function
returns the created Notification (or None if the call was a no-op) so callers
can inspect or chain further actions.
"""

from django.db import models

from .models import Notification


def notify_welcome(user) -> Notification | None:
    """Welcome message shown after first successful OTP verification."""
    return Notification.objects.create(
        user=user,
        type='welcome',
        title='Welcome to the Mbo Youth Portal',
        message=(
            'Your account is now active. Browse available scholarship, grant, '
            'and empowerment programmes and apply when you are ready.'
        ),
    )


def notify_application_submitted(user, application) -> Notification:
    """Confirmation after a student submits an application (no conflict)."""
    scheme = getattr(application, 'scheme', None)
    scheme_name = scheme.name if scheme else 'a programme'
    return Notification.objects.create(
        user=user,
        type='application',
        title='Application Received',
        message=(
            f'Your application for "{scheme_name}" has been submitted '
            f'successfully. A verification officer will review it shortly.'
        ),
    )


def notify_award_conflict(user, application) -> Notification:
    """Alert when the eligibility engine flags a double-dip conflict."""
    scheme = getattr(application, 'scheme', None)
    scheme_name = scheme.name if scheme else 'a programme'
    return Notification.objects.create(
        user=user,
        type='application',
        title='Award Conflict Detected',
        message=(
            f'Your application for "{scheme_name}" was flagged because you '
            f'may hold an active award. Submit a waiver from your applications '
            f'page so an administrator can review your case.'
        ),
    )


def notify_application_status_update(user, application, new_status: str) -> Notification:
    """Let the student know a verifier has reviewed their application."""
    scheme = getattr(application, 'scheme', None)
    scheme_name = scheme.name if scheme else 'your application'

    if new_status == 'approved':
        title = f'{scheme_name} — Approved'
        message = (
            f'Congratulations! Your application for "{scheme_name}" has been '
            f'approved. The award has been recorded on your profile.'
        )
    elif new_status == 'rejected':
        title = f'{scheme_name} — Not Selected'
        message = (
            f'Your application for "{scheme_name}" was not selected at this '
            f'time. New programmes are published regularly — apply again.'
        )
    elif new_status == 'shortlisted':
        title = f'{scheme_name} — Shortlisted'
        message = (
            f'Your application for "{scheme_name}" has been shortlisted. '
            f'Further review is in progress.'
        )
    else:
        title = f'{scheme_name} — Status Updated'
        message = (
            f'Your application for "{scheme_name}" is now "{new_status}".'
        )

    return Notification.objects.create(
        user=user,
        type='application',
        title=title,
        message=message,
    )


def notify_approval_published(user, application) -> Notification:
    """Student is notified when the verifier publishes scheme results."""
    scheme = getattr(application, 'scheme', None)
    scheme_name = scheme.name if scheme else 'a programme'
    return Notification.objects.create(
        user=user,
        type='application',
        title=f'{scheme_name} — Results Published',
        message=(
            f'The results for "{scheme_name}" have been published. '
            f'View your application for the full decision details.'
        ),
    )


def notify_new_application_in_queue(application) -> None:
    """Send alert to all verifier/admin staff that a new app is in the queue.

    Fires on submission — creates one notification per staff user so they see
    it when they log into the verifier or admin dashboard.
    """
    from accounts.models import User, Role
    scheme = getattr(application, 'scheme', None)
    scheme_name = scheme.name if scheme else 'a programme'

    staff_users = User.objects.filter(
        role__in=[Role.VERIFIER, Role.ADMIN, Role.SUPERADMIN],
    )
    for staff in staff_users:
        Notification.objects.create(
            user=staff,
            type='alert',
            title='New Application in Queue',
            message=(
                f'A new application for "{scheme_name}" has been submitted '
                f'and is ready for review.'
            ),
        )


def notify_profile_verified(user) -> Notification:
    """Student notification after admin approves their identity verification."""
    return Notification.objects.create(
        user=user,
        type='profile',
        title='Profile Verified',
        message=(
            'Your identity and documents have been verified by the RMHCDT '
            'team. You can now browse and apply for available programmes.'
        ),
    )


def notify_password_changed(user) -> Notification:
    """Security notification after the user resets or changes their password."""
    from django.conf import settings
    support_email = getattr(settings, 'SUPPORT_EMAIL', 'support@mboempowerment.com')
    return Notification.objects.create(
        user=user,
        type='system',
        title='Password Changed',
        message=(
            f'Your password was recently changed. If you did not make this '
            f'change, please contact support immediately at {support_email}.'
        ),
    )
