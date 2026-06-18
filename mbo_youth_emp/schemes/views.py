from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from audit.models import AuditLog
from .models import ScholarshipScheme, Cycle
from .serializers import ScholarshipSchemeSerializer, CycleSerializer
from accounts.permissions import IsAdmin


# ── Cycle ViewSet ─────────────────────────────────────────────────────────────

class CycleViewSet(viewsets.ModelViewSet):
    """
    CRUD for programme cycles.
    Admin-only for write operations; anyone can read.
    """
    queryset           = Cycle.objects.all().order_by('-start_year')
    serializer_class   = CycleSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAdmin()]

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        """POST /schemes/cycles/{id}/activate/ — make this the active cycle."""
        Cycle.objects.all().update(is_active=False)
        cycle = self.get_object()
        cycle.is_active = True
        cycle.save()
        return Response({'status': 'Cycle activated', 'cycle': CycleSerializer(cycle).data})


# ── ScholarshipScheme ViewSet ─────────────────────────────────────────────────

class ScholarshipSchemeViewSet(viewsets.ModelViewSet):
    queryset           = ScholarshipScheme.objects.all().order_by('-created_at')
    serializer_class   = ScholarshipSchemeSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        if self.action == 'fields':
            return [IsAuthenticated()]
        return [IsAdmin()]

    def get_queryset(self):
        queryset = ScholarshipScheme.objects.select_related(
            'provider', 'cycle'
        ).order_by('-created_at')

        user = self.request.user
        is_admin = user and user.is_authenticated and user.role in ['admin', 'superadmin']

        if not is_admin:
            queryset = queryset.filter(is_published=True, is_active=True)

        award_type = self.request.query_params.get('award_type')
        if award_type:
            queryset = queryset.filter(award_type=award_type)

        cycle_param = self.request.query_params.get('cycle')
        if cycle_param == 'active':
            active_cycle = Cycle.get_active()
            if active_cycle:
                queryset = queryset.filter(cycle=active_cycle)
        elif cycle_param:
            queryset = queryset.filter(cycle__id=cycle_param)

        return queryset

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """POST /schemes/{id}/publish/"""
        scheme = self.get_object()
        scheme.is_published = True
        scheme.is_active    = True
        scheme.save()

        AuditLog.objects.create(
            admin=request.user,
            action=f"Published scheme '{scheme.name}'",
            entity_type="Scheme",
            entity_id=str(scheme.id),
        )

        return Response({
            'status': 'scheme published successfully',
            'is_published': scheme.is_published,
            'is_active': scheme.is_active
        })

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """POST /schemes/{id}/close/"""
        scheme = self.get_object()
        scheme.is_active = False
        scheme.save()

        AuditLog.objects.create(
            admin=request.user,
            action=f"Closed scheme '{scheme.name}'",
            entity_type="Scheme",
            entity_id=str(scheme.id),
        )

        return Response({
            'status': 'scheme closed successfully',
            'is_active': scheme.is_active
        })

    @action(detail=True, methods=['get'], url_path='fields')
    def fields(self, request, pk=None):
        """GET /schemes/{id}/fields/ — returns field definitions for the apply form."""
        from applications.serializers import PROGRAMME_ANSWER_SERIALIZERS, REQUIRED_DOCUMENTS

        scheme = self.get_object()

        serializer_cls = PROGRAMME_ANSWER_SERIALIZERS.get(scheme.award_type)
        if serializer_cls is None:
            return Response(
                {"error": f"Unknown award type '{scheme.award_type}'"},
                status=400,
            )

        required_doc_keys = [k for k, _ in REQUIRED_DOCUMENTS.get(scheme.award_type, [])]

        FIELD_META = {
            'institution_name':        {'label': 'Institution Name',        'type': 'text',     'section': 'Academic Information', 'placeholder': 'e.g. University of Calabar'},
            'course_of_study':         {'label': 'Course of Study',         'type': 'text',     'section': 'Academic Information', 'placeholder': 'e.g. Computer Science'},
            'current_level':           {'label': 'Current Level',           'type': 'select',   'section': 'Academic Information', 'options': ['100', '200', '300', '400', '500', '600']},
            'cgpa':                    {'label': 'CGPA',                    'type': 'number',   'section': 'Academic Information', 'placeholder': 'e.g. 3.50'},
            'admission_year':          {'label': 'Admission Year',          'type': 'number',   'section': 'Academic Information', 'placeholder': 'e.g. 2022'},
            'matric_number':           {'label': 'Matriculation Number',    'type': 'text',     'section': 'Academic Information', 'placeholder': 'e.g. UG/2022/001'},
            'trade_or_skill':          {'label': 'Trade / Skill',           'type': 'text',     'section': 'Business / Trade Information', 'placeholder': 'e.g. Welding, Tailoring'},
            'training_provider':       {'label': 'Training Provider',       'type': 'text',     'section': 'Business / Trade Information', 'placeholder': 'e.g. NABTEB Training Centre'},
            'training_duration_months':{'label': 'Training Duration (months)', 'type': 'number','section': 'Business / Trade Information', 'placeholder': 'e.g. 6'},
            'prior_experience':        {'label': 'Prior Experience',        'type': 'textarea', 'section': 'Business / Trade Information', 'placeholder': 'Describe any relevant experience'},
            'business_name':           {'label': 'Business Name',           'type': 'text',     'section': 'Grant Details', 'placeholder': 'e.g. Mbo Fish Farm'},
            'business_stage':          {'label': 'Business Stage',          'type': 'select',   'section': 'Grant Details', 'options': ['idea', 'startup', 'growth', 'mature']},
            'business_description':    {'label': 'Business Description',    'type': 'textarea', 'section': 'Grant Details', 'placeholder': 'Describe your business'},
            'requested_amount':        {'label': 'Amount Requested (₦)',    'type': 'number',   'section': 'Grant Details', 'placeholder': 'e.g. 500000'},
            'intended_use':            {'label': 'Intended Use',            'type': 'textarea', 'section': 'Grant Details', 'placeholder': 'How will you use this grant?'},
            'admission_letter':        {'label': 'Admission Letter',        'type': 'file',     'section': 'Documents'},
            'last_result':             {'label': 'Latest Result',           'type': 'file',     'section': 'Documents'},
        }

        serializer = serializer_cls()
        fields = []

        for field_name, drf_field in serializer.fields.items():
            meta = FIELD_META.get(field_name, {})
            fields.append({
                'field_name':  field_name,
                'field_label': meta.get('label', field_name.replace('_', ' ').title()),
                'field_type':  meta.get('type', 'text'),
                'section':     meta.get('section', 'Details'),
                'placeholder': meta.get('placeholder', ''),
                'options':     meta.get('options', []),
                'is_required': drf_field.required,
            })

        for doc_key in required_doc_keys:
            meta = FIELD_META.get(doc_key, {})
            fields.append({
                'field_name':  doc_key,
                'field_label': meta.get('label', doc_key.replace('_', ' ').title()),
                'field_type':  'file',
                'section':     'Documents',
                'placeholder': '',
                'options':     [],
                'is_required': True,
            })

        return Response(fields)