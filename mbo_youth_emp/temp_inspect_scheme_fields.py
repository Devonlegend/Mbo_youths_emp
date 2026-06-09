import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mbo_youth_emp.config.settings')
root = os.path.dirname(os.path.dirname(__file__))
if root not in sys.path:
    sys.path.insert(0, root)
os.chdir(os.path.dirname(__file__))
django.setup()

from schemes.models import ScholarshipScheme

schemes = ScholarshipScheme.objects.filter(is_published=True)
print('COUNT', schemes.count())
for scheme in schemes:
    print('SCHEME', scheme.id, scheme.name, scheme.award_type)
    for field in scheme.form_fields.all():
        print(' ', field.field_name, field.field_label, field.field_type, field.is_required)
    print('---')
