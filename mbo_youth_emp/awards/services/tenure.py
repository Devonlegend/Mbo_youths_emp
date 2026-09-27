"""Tenure resolution: how many yearly payments does this award cover?

Pure computation — no DB writes, no imports of the dynamic application models.
``application_row`` is duck-typed (anything with ``current_level`` /
``course_of_study`` / ``admission_year`` attributes works), which keeps this
testable without touching the per-scheme application tables.

Design rules (from RECURRING_SCHOLARSHIPS_PLAN.md §3.1, hardened in review):

1.  **Never raise.** This runs inside ``review()``'s ``transaction.atomic()``
    block — an exception here would roll back the whole approval. Every
    unparseable/blank input degrades to ``total_years=1`` + a flag instead.

2.  **Tenure counts from the student's CURRENT level, not entry level.**
    The award starts paying this cycle. A 300L student in a 4-yr course has
    two payments left (300L, 400L), so::

        total = duration - (current_level // 100 - 1)

    ``entry_level`` (100 vs 200 direct-entry) stays on the profile for
    record-keeping but does NOT drive tenure math — using it would overpay
    every mid-course applicant.

3.  **Free-text inference is a hint, never a silent value.** When duration
    comes from keyword-matching ``course_of_study`` (or an assumed default),
    confidence drops to INFERRED and a flag explains why, so the admin queue
    can send a human to confirm. A wrong tenure doesn't error — it just pays
    the wrong number of years — so silent guessing is the worst outcome.

4.  **Clamp to [1, 6] and flag on clamp.** 6 = Medicine/Dentistry/Vet at
    100L, the longest real tenure. A value needing clamping means the input
    data was wrong; say so.
"""

from dataclasses import dataclass, field

from students.models import ProgrammeType

# Longest real tenure: 6-yr faculty (Medicine/Dentistry/Vet) entered at 100L.
MIN_TENURE = 1
MAX_TENURE = 6


class TenureConfidence:
    """How much a human can trust the resolved number.

    CONFIRMED — duration came from the student's explicit profile field.
    INFERRED  — duration/level was derived (course-text keyword match, or a
                programme-type default). Shown to admins for confirmation.
    DEGRADED  — inputs were missing/unparseable; fell back to 1 year. Always
                needs admin attention.
    """
    CONFIRMED = 'confirmed'
    INFERRED  = 'inferred'
    DEGRADED  = 'degraded'


@dataclass
class TenureResolution:
    total_years: int
    confidence: str                     # TenureConfidence value
    programme_type: str                 # resolved (possibly inferred) type
    flags: list = field(default_factory=list)  # human-readable admin notes

    @property
    def needs_admin_attention(self):
        return self.confidence != TenureConfidence.CONFIRMED or bool(self.flags)


# Keyword → duration, matched against lowercase course_of_study / faculty.
# Order matters: first match wins, so longer/more-specific programmes first.
# This is a HINT source only — matches always yield INFERRED confidence.
_DURATION_KEYWORDS = [
    # 6 years
    (6, ['medicine', 'mbbs', 'mbchb', 'dentistry', 'dental surgery',
         'veterinary', 'vet medicine', 'doctor of pharmacy', 'pharmd']),
    # 5 years
    (5, ['engineering', 'engg', 'law', 'llb', 'architecture', 'pharmacy',
         'nursing', 'physiotherapy', 'medical laboratory', 'medlab']),
    # 4 years is the undergrad default — no keywords needed.
]

_DEFAULT_DURATION = {
    ProgrammeType.UNDERGRADUATE:       4,
    ProgrammeType.HND:                 2,
    ProgrammeType.POSTGRAD_TAUGHT:     1,
    ProgrammeType.POSTGRAD_RESEARCH:   3,
}


def parse_level(raw):
    """'200' → 200, '200L' → 200, 'Postgraduate'/''/None → None. Never raises."""
    if raw is None:
        return None
    digits = ''.join(ch for ch in str(raw) if ch.isdigit())
    return int(digits) if digits else None


def _infer_duration(text):
    """First keyword match → (duration, matched_keyword); else (None, None)."""
    text = str(text or '').lower()
    if not text:
        return None, None
    for years, keywords in _DURATION_KEYWORDS:
        for kw in keywords:
            if kw in text:
                return years, kw
    return None, None


def _infer_programme_type(current_level):
    """Missing profile type: a numeric level means undergraduate (today's
    default behavior); anything else is unresolvable → None."""
    if current_level is not None and 100 <= current_level <= 500:
        return ProgrammeType.UNDERGRADUATE
    return None


def resolve_total_years(student, application_row):
    """Return a TenureResolution for a newly approved recurring award.

    ``student``        — students.Student (uses the academic-profile fields
                         added in PR 1: programme_type, programme_duration_years,
                         faculty).
    ``application_row``— duck-typed row from the scheme's application table
                         (needs .current_level, .course_of_study).
    """
    flags = []

    # ── 1. Programme type ────────────────────────────────────────────────
    current_level = parse_level(getattr(application_row, 'current_level', None))

    programme_type = student.programme_type or _infer_programme_type(current_level)
    if not student.programme_type:
        if programme_type:
            flags.append(f"programme_type not on profile — inferred '{programme_type}'")
        else:
            # Unresolvable type AND no type on profile: safest is a single
            # payment + human review.
            return TenureResolution(
                total_years=MIN_TENURE,
                confidence=TenureConfidence.DEGRADED,
                programme_type='',
                flags=[f"programme_type unknown and level "
                       f"'{getattr(application_row, 'current_level', None)}' unparseable — "
                       "defaulted to 1 year, confirm manually"],
            )

    # ── 2. Duration ──────────────────────────────────────────────────────
    confidence = TenureConfidence.CONFIRMED
    duration = student.programme_duration_years

    if duration:
        source_text = None
    else:
        # Infer from faculty first (admin-entered, cleaner), then course text.
        duration, kw = _infer_duration(student.faculty)
        source_text = 'faculty'
        if duration is None:
            duration, kw = _infer_duration(getattr(application_row, 'course_of_study', ''))
            source_text = 'course of study'
        if duration is not None:
            confidence = TenureConfidence.INFERRED
            flags.append(f"duration {duration}yr inferred from {source_text} "
                         f"(matched '{kw}') — confirm")
        else:
            duration = _DEFAULT_DURATION[programme_type]
            confidence = TenureConfidence.INFERRED
            flags.append(f"duration not on profile and unmatched by lookup — "
                         f"assumed {duration}yr default for {programme_type}, confirm")

    # ── 3. Remaining years from CURRENT level ────────────────────────────
    if programme_type == ProgrammeType.UNDERGRADUATE:
        if current_level is None:
            return TenureResolution(
                total_years=MIN_TENURE,
                confidence=TenureConfidence.DEGRADED,
                programme_type=programme_type,
                flags=flags + [f"current_level "
                               f"'{getattr(application_row, 'current_level', None)}' "
                               "unparseable — defaulted to 1 year, confirm manually"],
            )
        total = duration - (current_level // 100 - 1)
    else:
        # HND / PG: no level progression — tenure is the full programme
        # duration from the award start.
        total = duration

    # ── 4. Clamp + flag ──────────────────────────────────────────────────
    if total < MIN_TENURE or total > MAX_TENURE:
        clamped = max(MIN_TENURE, min(MAX_TENURE, total))
        flags.append(f"computed tenure {total} out of range "
                     f"[{MIN_TENURE},{MAX_TENURE}] — clamped to {clamped}, "
                     "input data likely wrong, confirm manually")
        total = clamped
        if confidence == TenureConfidence.CONFIRMED:
            confidence = TenureConfidence.INFERRED

    return TenureResolution(
        total_years=total,
        confidence=confidence,
        programme_type=programme_type,
        flags=flags,
    )
