import hashlib
import re

from django.conf import settings

# A Nigerian NIN is exactly 11 digits.
_NIN_RE = re.compile(r'^\d{11}$')


def hash_nin(raw_nin):
    """Hash a raw 11-digit NIN for storage and uniqueness checks.

    The NIN is mixed with a server-only secret pepper (settings.NIN_HASH_PEPPER)
    before SHA-256 so the stored value can't be brute-forced offline despite the
    NIN's tiny (10^11) keyspace. The result is a deterministic 64-char hex digest,
    which lets us enforce a unique constraint on it across users.

    Raises ValueError if the input is not exactly 11 digits.
    """
    nin = (raw_nin or '').strip()
    if not _NIN_RE.match(nin):
        raise ValueError('NIN must be exactly 11 digits')
    peppered = f'{settings.NIN_HASH_PEPPER}{nin}'.encode('utf-8')
    return hashlib.sha256(peppered).hexdigest()
