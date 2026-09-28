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
            'Your identity and documents have been verified by the Mbo Youth Empowerment '
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


# ── Recurring (multi-year) awards ──────────────────────────────────────────

def notify_new_renewal_in_queue(installment) -> None:
    """Alert every verifier/admin that a student submitted a yearly renewal.

    Mirrors notify_new_application_in_queue: one in-app row per staff user so
    the renewal appears in their dashboard the next time they log in.
    """
    from accounts.models import User, Role
    award = installment.award
    scheme_name = award.scheme.name
    for staff in User.objects.filter(
        role__in=[Role.VERIFIER, Role.ADMIN, Role.SUPERADMIN],
    ):
        Notification.objects.create(
            user=staff,
            type='alert',
            title='Renewal Awaiting Verification',
            message=(
                f'{award.student.full_name} submitted year '
                f'{installment.year_index} of their "{scheme_name}" award. '
                f'It is ready for verification.'
            ),
        )


def notify_renewal_received(installment) -> Notification:
    """Student confirmation that their renewal submission was received."""
    award = installment.award
    return Notification.objects.create(
        user=award.student,
        type='application',
        title='Renewal Submitted',
        message=(
            f'Your year {installment.year_index} renewal for '
            f'"{award.scheme.name}" has been received. A verification officer '
            f'will review it shortly.'
        ),
    )


def notify_renewal_approved(installment) -> Notification:
    """Student notification that a renewal passed verification."""
    award = installment.award
    return Notification.objects.create(
        user=award.student,
        type='application',
        title='Renewal Approved',
        message=(
            f'Your year {installment.year_index} renewal for '
            f'"{award.scheme.name}" has been approved and queued for payment.'
        ),
    )


def notify_renewal_rejected(installment, note: str = '') -> Notification:
    """Student notification that a renewal was returned for resubmission."""
    award = installment.award
    message = (
        f'Your year {installment.year_index} renewal for '
        f'"{award.scheme.name}" needs attention and was sent back for '
        f'resubmission.'
    )
    if note:
        message += f' Verifier note: {note}'
    return Notification.objects.create(
        user=award.student,
        type='application',
        title='Renewal Needs Resubmission',
        message=message,
    )


def notify_award_suspended(award, reason: str = '') -> Notification:
    """Student notification that their award was suspended (breach / no
    renewal). Includes the appeal path, which is the only way back."""
    message = (
        f'Your "{award.scheme.name}" award has been suspended.'
    )
    if reason:
        message += f' Reason: {reason}.'
    message += (
        ' You can submit an appeal from your scholarship dashboard if you '
        'believe this is an error.'
    )
    return Notification.objects.create(
        user=award.student,
        type='alert',
        title='Award Suspended',
        message=message,
    )


def notify_installment_disbursed(installment) -> Notification:
    """Student notification that a payment year was disbursed."""
    award = installment.award
    return Notification.objects.create(
        user=award.student,
        type='application',
        title='Payment Disbursed',
        message=(
            f'Your year {installment.year_index} payment of '
            f'₦{installment.amount} for "{award.scheme.name}" has been '
            f'disbursed.'
        ),
    )


def notify_award_graduated(award) -> Notification:
    """Congratulation notification when the final installment is disbursed."""
    return Notification.objects.create(
        user=award.student,
        type='application',
        title='Scholarship Completed',
        message=(
            f'Congratulations! You have completed all {award.total_years} '
            f'payment years of your "{award.scheme.name}" award.'
        ),
    )


def notify_new_appeal_in_queue(appeal) -> None:
    """Alert verifier/admin staff that a suspended student filed an appeal."""
    from accounts.models import User, Role
    award = appeal.award
    for staff in User.objects.filter(
        role__in=[Role.VERIFIER, Role.ADMIN, Role.SUPERADMIN],
    ):
        Notification.objects.create(
            user=staff,
            type='alert',
            title='Award Appeal Filed',
            message=(
                f'{award.student.full_name} appealed the suspension of their '
                f'"{award.scheme.name}" award. It is ready for review.'
            ),
        )


def notify_appeal_received(appeal) -> Notification:
    """Confirmation to the student that their appeal was received."""
    return Notification.objects.create(
        user=appeal.award.student,
        type='application',
        title='Appeal Submitted',
        message=(
            f'Your appeal for the "{appeal.award.scheme.name}" award has been '
            f'received. A review officer will look into it.'
        ),
    )


def notify_appeal_decision(appeal) -> Notification:
    """Tell the student the outcome of their appeal."""
    award = appeal.award
    if appeal.status == 'upheld':
        title = 'Appeal Upheld'
        message = (
            f'Your appeal for the "{award.scheme.name}" award was upheld. The '
            f'award has been reinstated.'
        )
    else:
        title = 'Appeal Not Successful'
        message = (
            f'Your appeal for the "{award.scheme.name}" award was reviewed and '
            f'not upheld. The award has been terminated.'
        )
    if appeal.review_note:
        message += f' Note: {appeal.review_note}'
    return Notification.objects.create(
        user=award.student,
        type='application',
        title=title,
        message=message,
    )
