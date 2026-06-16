"""Staff admin forms for creating an application by hand.

Applications live in per-scheme dynamic tables, so there is no ModelForm to bind
to. `build_application_form` returns a plain Form whose award-answer fields match
the scheme's award type (mirroring applications/dynamic.py and the API answer
serializers). The view feeds the cleaned data straight into create_application.
"""

import json

from django import forms

from students.models import Student
from .models import ApplicationStatus


# award_type → ordered list of (field_name, Field) for the typed answers. Mirrors
# applications.dynamic._award_fields so the admin collects exactly the columns the
# table has.
def _answer_fields(award_type):
    if award_type == 'scholarship':
        return [
            ('institution_name', forms.CharField(max_length=200)),
            ('course_of_study',  forms.CharField(max_length=200)),
            ('current_level',    forms.CharField(max_length=20)),
            ('cgpa',             forms.DecimalField(max_digits=4, decimal_places=2)),
            ('admission_year',   forms.IntegerField()),
            ('matric_number',    forms.CharField(max_length=50)),
        ]
    if award_type == 'empowerment':
        return [
            ('trade_or_skill',           forms.CharField(max_length=120)),
            ('training_provider',        forms.CharField(max_length=200, required=False)),
            ('training_duration_months', forms.IntegerField(required=False)),
            ('prior_experience',         forms.CharField(required=False, widget=forms.Textarea)),
        ]
    if award_type == 'grant':
        return [
            ('business_name',        forms.CharField(max_length=200)),
            ('business_stage',       forms.ChoiceField(choices=[
                ('idea', 'Idea Stage'), ('startup', 'Startup / Early-stage'),
                ('growth', 'Growth Stage'), ('mature', 'Established'),
            ])),
            ('business_description', forms.CharField(widget=forms.Textarea)),
            ('requested_amount',     forms.DecimalField(max_digits=12, decimal_places=2)),
            ('intended_use',         forms.CharField(widget=forms.Textarea)),
        ]
    raise ValueError(f"Unknown award_type '{award_type}'")


class _JSONField(forms.CharField):
    """A textarea that parses to JSON, defaulting to the given empty value."""
    def __init__(self, *args, empty, **kwargs):
        self._empty = empty
        kwargs.setdefault('required', False)
        kwargs.setdefault('widget', forms.Textarea(attrs={'rows': 3}))
        super().__init__(*args, **kwargs)

    def clean(self, value):
        value = super().clean(value)
        if not value or not value.strip():
            return self._empty
        try:
            return json.loads(value)
        except json.JSONDecodeError as e:
            raise forms.ValidationError(f"Invalid JSON: {e}")


def build_application_form(scheme):
    """Return a bound-able Form class tailored to `scheme`'s award type."""

    fields = {
        'student': forms.ModelChoiceField(
            queryset=Student.objects.select_related('user').order_by('firstname', 'lastname'),
        ),
        'status': forms.ChoiceField(
            choices=ApplicationStatus.choices,
            help_text="Status to store. Eligibility is still recorded for reference.",
        ),

        # Bank snapshot
        'bank_name':       forms.CharField(max_length=120),
        'bank_code':       forms.CharField(max_length=10),
        'account_number':  forms.CharField(max_length=20),
        'account_name':    forms.CharField(max_length=200),
        'name_match_passed': forms.BooleanField(required=False),

        # Self-declaration
        'self_declaration_received_support': forms.BooleanField(required=False),
        'self_declaration_details': _JSONField(
            empty=[],
            help_text='JSON list, e.g. [{"organisation": "X", "category": "Y", "year": 2025}]',
        ),

        # Attestation
        'attestation_agreed': forms.BooleanField(required=False, initial=True),

        # Documents
        'documents': _JSONField(
            empty={},
            help_text='JSON object of document URLs, e.g. {"admission_letter": "https://..."}',
        ),
    }

    for name, field in _answer_fields(scheme.award_type):
        fields[f'answer__{name}'] = field

    def clean(self):
        cleaned = super(form_cls, self).clean()
        if cleaned.get('self_declaration_received_support') and not cleaned.get('self_declaration_details'):
            self.add_error(
                'self_declaration_details',
                "Received-support is ticked — list the prior support as JSON.",
            )
        return cleaned

    def answers(self):
        """Pull the typed answer values back out of cleaned_data."""
        return {
            k[len('answer__'):]: v
            for k, v in self.cleaned_data.items()
            if k.startswith('answer__')
        }

    def bank(self):
        return {
            'bank_name':       self.cleaned_data['bank_name'],
            'bank_code':       self.cleaned_data['bank_code'],
            'account_number':  self.cleaned_data['account_number'],
            'account_name':    self.cleaned_data['account_name'],
            'name_match_passed': self.cleaned_data['name_match_passed'],
        }

    form_cls = type('ApplicationAdminForm', (forms.Form,), {
        **fields, 'clean': clean, 'answers': answers, 'bank': bank,
    })
    return form_cls
