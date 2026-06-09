import os, django, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE','mbo_youth_emp.config.settings')
root = os.path.dirname(os.path.dirname(__file__))
if root not in sys.path:
    sys.path.insert(0, root)
os.chdir(os.path.dirname(__file__))
django.setup()
from schemes.serializers import ScholarshipSchemeSerializer
payload = {
    'name': 'Test Scheme',
    'award_type': 'scholarship',
    'description': 'Test description',
    'academic_year': '2026/2027',
    'award_amount': 100000,
    'total_slots': 10,
    'remaining_slots': 10,
    'stacking_policy': 'major_only',
    'application_open_date': '2026-09-01',
    'application_close_date': '2026-10-01',
    'is_active': True,
    'is_published': False,
}
ser = ScholarshipSchemeSerializer(data=payload)
print('is_valid', ser.is_valid())
print('errors', ser.errors)
print('validated', ser.validated_data)
