from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import ScholarshipScheme, Cycle, SchemeProvider
from .serializers import ScholarshipSchemeSerializer, CycleSerializer, SchemeProviderSerializer
from accounts.permissions import IsAdmin


class SchemeProviderViewSet(viewsets.ModelViewSet):
    queryset           = SchemeProvider.objects.all().order_by('name')
    serializer_class   = SchemeProviderSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAdmin()]


class CycleViewSet(viewsets.ModelViewSet):
   
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
        # Deactivate all others first
        Cycle.objects.all().update(is_active=False)
        cycle = self.get_object()
        cycle.is_active = True
        cycle.save()
        return Response({'status': 'Cycle activated', 'cycle': CycleSerializer(cycle).data})




class ScholarshipSchemeViewSet(viewsets.ModelViewSet):
    queryset           = ScholarshipScheme.objects.all().order_by('-created_at')
    serializer_class   = ScholarshipSchemeSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'fields']:
            return [AllowAny()]
        return [IsAdmin()]

    def get_queryset(self):
        queryset = ScholarshipScheme.objects.select_related(
            'provider', 'cycle'
        ).order_by('-created_at')

        user = self.request.user
        is_admin = user and user.is_authenticated and user.role in ['admin', 'superadmin']

        # Non-admins only see published + active schemes
        if not is_admin:
            queryset = queryset.filter(is_published=True, is_active=True)

        # Filter by award_type
        award_type = self.request.query_params.get('award_type')
        if award_type:
            queryset = queryset.filter(award_type=award_type)

        # Filter by cycle — 'active' means the currently active cycle
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
        return Response({
            'status': 'scheme closed successfully',
            'is_active': scheme.is_active
        })

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """POST /schemes/{id}/reopen/"""
        scheme = self.get_object()
        scheme.is_active = True
        scheme.save()
        return Response({
            'status': 'scheme reopened successfully',
            'is_active': scheme.is_active
        })

    @action(detail=True, methods=['get'])
    def fields(self, request, pk=None):
        """GET /schemes/{id}/fields/ — form-field definitions for the dynamic apply page."""
        scheme = self.get_object()
        criteria = scheme.eligibility_criteria or {}

        if scheme.award_type == 'scholarship':
            defs = [
                {'field_name': 'institution_name', 'field_label': 'Institution Name', 'field_type': 'text', 'placeholder': 'e.g. University of Lagos', 'is_required': True, 'section': 'Academic Information', 'options': []},
                {'field_name': 'course_of_study',  'field_label': 'Course of Study',  'field_type': 'text', 'placeholder': 'e.g. Computer Science',   'is_required': True, 'section': 'Academic Information', 'options': []},
                {'field_name': 'current_level',    'field_label': 'Current Level',    'field_type': 'select', 'placeholder': '', 'is_required': True, 'section': 'Academic Information', 'options': criteria.get('allowed_levels', ['100','200','300','400','500'])},
                {'field_name': 'cgpa',             'field_label': 'CGPA',             'field_type': 'number', 'placeholder': 'e.g. 3.50', 'is_required': True, 'section': 'Academic Information', 'options': []},
                {'field_name': 'admission_year',   'field_label': 'Admission Year',   'field_type': 'number', 'placeholder': 'e.g. 2023', 'is_required': True, 'section': 'Academic Information', 'options': []},
                {'field_name': 'matric_number',    'field_label': 'Matric Number',    'field_type': 'text',   'placeholder': 'e.g. U2019/1234567', 'is_required': True, 'section': 'Academic Information', 'options': []},
                {'field_name': 'admission_letter', 'field_label': 'Admission Letter', 'field_type': 'file',   'placeholder': 'Upload your admission letter (PDF, JPG or PNG)', 'is_required': True, 'section': 'Documents', 'options': []},
                {'field_name': 'last_result',      'field_label': 'Latest Result',    'field_type': 'file',   'placeholder': 'Upload your latest result (PDF, JPG or PNG)',  'is_required': True, 'section': 'Documents', 'options': []},
            ]

        elif scheme.award_type == 'empowerment':
            defs = [
                {'field_name': 'trade_or_skill',           'field_label': 'Trade or Skill',           'field_type': 'select',   'placeholder': '', 'is_required': True,  'section': 'Training Details', 'options': criteria.get('allowed_trades', [])},
                {'field_name': 'training_provider',        'field_label': 'Training Provider',         'field_type': 'text',     'placeholder': 'e.g. NDE Training Centre', 'is_required': False, 'section': 'Training Details', 'options': []},
                {'field_name': 'training_duration_months', 'field_label': 'Training Duration (months)','field_type': 'number',   'placeholder': 'e.g. 6', 'is_required': False, 'section': 'Training Details', 'options': []},
                {'field_name': 'prior_experience',         'field_label': 'Prior Experience',           'field_type': 'textarea', 'placeholder': 'Describe any prior experience', 'is_required': False, 'section': 'Training Details', 'options': []},
            ]

        elif scheme.award_type == 'grant':
            defs = [
                {'field_name': 'business_name',        'field_label': 'Business Name',      'field_type': 'text',     'placeholder': "e.g. Ada's Fashion House", 'is_required': True,  'section': 'Business Information', 'options': []},
                {'field_name': 'business_stage',       'field_label': 'Business Stage',     'field_type': 'select',   'placeholder': '', 'is_required': True,  'section': 'Business Information', 'options': ['Idea Stage','Startup / Early-stage','Growth Stage','Established']},
                {'field_name': 'business_description', 'field_label': 'Business Description','field_type': 'textarea', 'placeholder': 'Describe your business and what it does', 'is_required': True,  'section': 'Business Information', 'options': []},
                {'field_name': 'requested_amount',     'field_label': 'Requested Amount (₦)', 'field_type': 'number', 'placeholder': 'e.g. 50000', 'is_required': True,  'section': 'Business Information', 'options': []},
                {'field_name': 'intended_use',         'field_label': 'Intended Use',        'field_type': 'textarea', 'placeholder': 'How do you plan to use the funds?', 'is_required': True,  'section': 'Business Information', 'options': []},
            ]

        else:
            defs = []

        return Response(defs)
