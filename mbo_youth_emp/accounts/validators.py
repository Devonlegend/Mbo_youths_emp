"""Shared validation for user-uploaded files (passports, certificates).

Enforced at the request boundary so oversized or wrong-type uploads are
rejected before they reach Cloudinary or the database.
"""
from django.conf import settings

# 5 MB default; override with MAX_UPLOAD_SIZE_MB in the environment.
MAX_UPLOAD_BYTES = int(getattr(settings, 'MAX_UPLOAD_SIZE_MB', 5)) * 1024 * 1024

ALLOWED_UPLOAD_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/pdf': '.pdf',
}


class FileValidationError(Exception):
    """Raised when an uploaded file fails size or type checks."""


def validate_upload(uploaded_file, field_name='file', required=False):
    """Validate an uploaded file's size and content type.

    Returns the file unchanged on success. Raises FileValidationError with a
    user-safe message on failure.
    """
    if uploaded_file is None:
        if required:
            raise FileValidationError(f"{field_name} is required.")
        return None

    if uploaded_file.size > MAX_UPLOAD_BYTES:
        limit_mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise FileValidationError(
            f"{field_name} is too large (max {limit_mb} MB).")

    content_type = getattr(uploaded_file, 'content_type', None)
    if content_type not in ALLOWED_UPLOAD_TYPES:
        allowed = ', '.join(sorted(ALLOWED_UPLOAD_TYPES.values()))
        raise FileValidationError(
            f"{field_name} must be one of: {allowed}.")

    return uploaded_file
