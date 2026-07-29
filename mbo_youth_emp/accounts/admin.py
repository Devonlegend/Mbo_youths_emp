from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField

from . import models
from .models import Role
from .utils import hash_nin


class UserCreationForm(forms.ModelForm):
    """Add-user form for the admin.

    Prompts for a raw 11-digit NIN and a password, then stores the *hashed* NIN
    and a properly hashed password (via ``set_password``) — never plaintext.
    """
    nin = forms.CharField(
        label='NIN',
        max_length=11,
        help_text='Raw 11-digit NIN. Stored hashed; never persisted in the clear.',
    )
    password1 = forms.CharField(label='Password', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Confirm password', widget=forms.PasswordInput)

    class Meta:
        model = models.User
        fields = ('email', 'firstname', 'lastname', 'phone_number', 'role', 'gender', 'date_of_birth')

    def clean_nin(self):
        try:
            return hash_nin(self.cleaned_data['nin'])
        except ValueError:
            raise forms.ValidationError('NIN must be exactly 11 digits.')

    def clean_password2(self):
        p1 = self.cleaned_data.get('password1')
        p2 = self.cleaned_data.get('password2')
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError('Passwords do not match.')
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.nin_hash = self.cleaned_data['nin']  # already hashed by clean_nin
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user


class UserChangeForm(forms.ModelForm):
    """Change-user form. Shows the password hash read-only (with a link to the
    admin's change-password form) so it can never be overwritten in plaintext."""
    password = ReadOnlyPasswordHashField(
        label='Password',
        help_text='Raw passwords are not stored. Use the "change password" form via the link above.',
    )

    class Meta:
        model = models.User
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # passport is required on the model but staff accounts have none; don't
        # block editing an existing staff user just because they lack a passport.
        if 'passport' in self.fields:
            self.fields['passport'].required = False


@admin.register(models.User)
class UserAdmin(BaseUserAdmin):
    """Secure admin for the custom email-based User model.

    Backs all staff (admin/verifier/superadmin) management. NIN is stored hashed
    and shown read-only; privilege fields are locked for non-superusers.
    """
    add_form = UserCreationForm
    form = UserChangeForm
    model = models.User

    list_display = ('email', 'firstname', 'lastname', 'role', 'is_active', 'email_verified', 'created_at')
    list_filter = ('role', 'is_active', 'email_verified', 'is_superuser')
    search_fields = ('email', 'firstname', 'lastname', 'phone_number')
    ordering = ('email',)
    readonly_fields = ('nin_hash', 'created_at', 'last_login')
    filter_horizontal = ('groups', 'user_permissions')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal', {'fields': ('firstname', 'lastname', 'phone_number', 'gender', 'date_of_birth', 'passport')}),
        ('Identity', {'fields': ('nin_hash', 'email_verified')}),
        ('Role & permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'created_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'firstname', 'lastname', 'phone_number', 'role',
                       'gender', 'date_of_birth', 'nin', 'password1', 'password2'),
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        ro = list(super().get_readonly_fields(request, obj))
        # Only superusers may grant staff/superuser/role or edit permission sets,
        # so a regular staff member can't escalate themselves or others.
        if not request.user.is_superuser:
            ro += ['role', 'is_staff', 'is_superuser', 'groups', 'user_permissions']
        return ro
