"""Per-scheme application tables.

Every ``schemes.ScholarshipScheme`` owns its own physical DB table holding the
entire application (shared fields + bank snapshot + award-specific answers). There
is no shared ``Application`` table. This module builds one ``managed = False``
Django model class per scheme on demand (memoised), creates/drops the physical
table via ``schema_editor``, and provides the union helpers that cross-scheme
reads (dashboards, eligibility) rely on.

Sharp edges this design accepts (chosen deliberately):
  * ``award_type`` is immutable once a scheme exists — the table shape is fixed and
    SQLite cannot cheaply ALTER. Enforced in the scheme serializer.
  * Cross-scheme queries are UNIONs over every per-scheme table (see the helpers).
  * Changing the application shape later means rebuilding every table
    (``manage.py rebuild_application_tables``).
"""

import uuid

from django.db import connection, models

from schemes.models import ScholarshipScheme
from .models import ApplicationStatus


# Process-level cache: table_name -> dynamically built model class. Memoising is
# essential — rebuilding a model with the same class name/app_label twice trips
# Django's app registry. One class per scheme per process.
_MODEL_CACHE = {}


# ── Field builders ────────────────────────────────────────────────────────────
# Field instances bind to exactly one model, so every build must create FRESH
# instances — never share them between classes.

def _common_fields():
    """Fields present on every application, regardless of award type."""
    return {
        'id': models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False),

        # FKs use related_name='+' so the N per-scheme models never collide on a
        # reverse accessor (there is no `student.applications` here — use the
        # union helpers below instead).
        'student': models.ForeignKey(
            'students.Student', on_delete=models.CASCADE, related_name='+'),
        'scheme': models.ForeignKey(
            'schemes.ScholarshipScheme', on_delete=models.CASCADE, related_name='+'),
        'reviewed_by': models.ForeignKey(
            'accounts.User', null=True, blank=True,
            on_delete=models.SET_NULL, related_name='+'),

        'status': models.CharField(
            max_length=30, choices=ApplicationStatus.choices,
            default=ApplicationStatus.DRAFT),
        'submission_date': models.DateTimeField(null=True, blank=True),

        # Self-declaration
        'self_declaration_received_support': models.BooleanField(null=True),
        'self_declaration_details': models.JSONField(default=list, blank=True),

        # Attestation
        'attestation_agreed': models.BooleanField(default=False),
        'attestation_at': models.DateTimeField(null=True, blank=True),

        # Cloudinary document URLs
        'documents': models.JSONField(default=dict, blank=True),

        # Eligibility result (populated by EligibilityEngine)
        'eligibility_passed': models.BooleanField(null=True),
        'eligibility_details': models.JSONField(default=dict),

        # CBR conflict tracking
        'has_conflict': models.BooleanField(default=False),
        'conflict_scheme_ids': models.JSONField(default=list),

        # Waiver
        'waiver_submitted': models.BooleanField(default=False),

        # Review
        'reviewed_at': models.DateTimeField(null=True, blank=True),
        'reviewer_notes': models.TextField(blank=True),
        'rejection_reason': models.TextField(blank=True),

        'created_at': models.DateTimeField(auto_now_add=True),
        'updated_at': models.DateTimeField(auto_now=True),

        # Bank snapshot — collected fresh per application
        'bank_name': models.CharField(max_length=120),
        'bank_code': models.CharField(max_length=10),
        'account_number': models.CharField(max_length=20),
        'account_name': models.CharField(max_length=200),
        'name_match_passed': models.BooleanField(default=False),
    }


def _award_fields(award_type):
    """Award-type-specific answer fields. Mirrors the former typed detail models."""
    if award_type == 'scholarship':
        return {
            'institution_name': models.CharField(max_length=200),
            'course_of_study':  models.CharField(max_length=200),
            'current_level':    models.CharField(max_length=20),
            'cgpa':             models.DecimalField(max_digits=4, decimal_places=2),
            'admission_year':   models.IntegerField(),
            'matric_number':    models.CharField(max_length=50),
        }
    if award_type == 'empowerment':
        return {
            'trade_or_skill':           models.CharField(max_length=120),
            'training_provider':        models.CharField(max_length=200, blank=True, default=''),
            'training_duration_months': models.PositiveSmallIntegerField(null=True, blank=True),
            'prior_experience':         models.TextField(blank=True, default=''),
        }
    if award_type == 'grant':
        return {
            'business_name':        models.CharField(max_length=200),
            'business_stage':       models.CharField(max_length=30, choices=[
                ('idea',    'Idea Stage'),
                ('startup', 'Startup / Early-stage'),
                ('growth',  'Growth Stage'),
                ('mature',  'Established'),
            ]),
            'business_description': models.TextField(),
            'requested_amount':     models.DecimalField(max_digits=12, decimal_places=2),
            'intended_use':         models.TextField(),
        }
    raise ValueError(f"Unknown award_type '{award_type}'")


# The award-answer field names per type — used by serializers/views to know which
# keys belong to the typed payload vs the shared/bank fields.
ANSWER_FIELDS = {
    'scholarship': ['institution_name', 'course_of_study', 'current_level',
                    'cgpa', 'admission_year', 'matric_number'],
    'empowerment': ['trade_or_skill', 'training_provider',
                    'training_duration_months', 'prior_experience'],
    'grant':       ['business_name', 'business_stage', 'business_description',
                    'requested_amount', 'intended_use'],
}


# ── Model factory ─────────────────────────────────────────────────────────────

def _build_model(scheme):
    name = f"Application_{scheme.table_name}"

    class Meta:
        app_label = 'applications'
        managed   = False
        db_table  = scheme.table_name

    attrs = {
        '__module__': 'applications.dynamic',
        'Meta': Meta,
        **_common_fields(),
        **_award_fields(scheme.award_type),
    }
    return type(name, (models.Model,), attrs)


def get_application_model(scheme):
    """Return (memoised) the Django model class backing this scheme's table."""
    if not scheme.table_name:
        raise ValueError(
            f"Scheme {scheme.id} has no table_name — was it saved? "
            "Run manage.py rebuild_application_tables."
        )
    model = _MODEL_CACHE.get(scheme.table_name)
    if model is None:
        model = _build_model(scheme)
        _MODEL_CACHE[scheme.table_name] = model
    return model


# ── Physical table create / drop ──────────────────────────────────────────────

def build_application_table(scheme):
    """Create this scheme's physical table if it does not already exist."""
    model = get_application_model(scheme)
    if scheme.table_name not in connection.introspection.table_names():
        with connection.schema_editor() as se:
            se.create_model(model)
    return model


def drop_application_table(scheme):
    """Drop this scheme's physical table if it exists."""
    if not scheme.table_name:
        return
    model = get_application_model(scheme)
    if scheme.table_name in connection.introspection.table_names():
        with connection.schema_editor() as se:
            se.delete_model(model)


# ── Cross-scheme union helpers ────────────────────────────────────────────────

def iter_application_models():
    """Yield (scheme, Model) for every scheme whose table physically exists."""
    existing = set(connection.introspection.table_names())
    schemes = (ScholarshipScheme.objects
               .exclude(table_name='')
               .select_related('provider', 'cycle'))
    for scheme in schemes:
        if scheme.table_name in existing:
            yield scheme, get_application_model(scheme)


def find_application(app_id):
    """Locate an application by id across all per-scheme tables.

    Returns (scheme, Model, row) or None. This is the UNION cost for detail/
    review/waiver/history routes that only receive an application id.
    """
    for scheme, model in iter_application_models():
        row = model.objects.filter(id=app_id).first()
        if row is not None:
            return scheme, model, row
    return None


def applications_for_student(student, statuses=None):
    """All of a student's applications across every scheme table.

    Returns a list of rows (each carries `.scheme`), newest first.
    """
    rows = []
    for _scheme, model in iter_application_models():
        qs = model.objects.filter(student=student).select_related(
            'scheme__provider', 'scheme__cycle', 'student__user')
        if statuses:
            qs = qs.filter(status__in=statuses)
        rows.extend(qs)
    rows.sort(key=lambda r: r.created_at, reverse=True)
    return rows


def applications_by_status(statuses):
    """Every application across all schemes matching the given status(es)."""
    rows = []
    for _scheme, model in iter_application_models():
        qs = model.objects.filter(status__in=statuses).select_related(
            'scheme__provider', 'scheme__cycle', 'student__user')
        rows.extend(qs)
    rows.sort(key=lambda r: r.created_at, reverse=True)
    return rows
