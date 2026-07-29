import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    STUDENT   = 'student',   'Student'
    VERIFIER  = 'verifier',  'Verification Officer'
    ADMIN     = 'admin',     'LGA Administrator'
    SUPERADMIN = 'superadmin', 'Super Administrator'


class UserManager(BaseUserManager):
    def create_user(self, email, firstname, lastname, phone_number, role, nin_hash,
                    password=None, date_of_birth=None, gender=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        fields = {
            'email': self.normalize_email(email),
            'firstname': firstname,
            'lastname': lastname,
            'phone_number': phone_number,
            'role': role,
            'nin_hash': nin_hash,
            'date_of_birth': date_of_birth,
            'gender': gender or 'male',
        }
        fields.update(extra_fields)
        user = self.model(**fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, firstname, lastname, nin_hash, phone_number, password):
        # `createsuperuser` prompts for the raw 11-digit NIN (the prompt is labelled from
        # REQUIRED_FIELDS); hash it here so CLI-created superusers are stored the same way
        # as users registered through /auth/register/. `nin_hash` is the raw NIN here.
        from accounts.utils import hash_nin
        try:
            hashed = hash_nin(nin_hash)
        except ValueError:
            # Surface a clean message on the management command instead of a traceback.
            raise ValueError("NIN must be exactly 11 digits")
        user = self.create_user(email, firstname, lastname, phone_number, Role.SUPERADMIN, hashed, password)
        user.is_staff     = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email        = models.EmailField(unique=True)
    gender = models.CharField(max_length=10,default='male', choices=[('male', 'Male'), ('female', 'Female')])
    phone_number = models.CharField(max_length=15, unique=True)
    role         = models.CharField(max_length=20, choices=Role.choices)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    date_of_birth = models.DateField(null=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    firstname    = models.CharField(max_length=50)
    lastname     = models.CharField(max_length=50)
    nin_hash     = models.CharField(max_length=64, unique=True)
    email_verified = models.BooleanField(default=False)
    passport = models.FileField(null= False)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['phone_number', 'firstname', 'lastname', 'nin_hash']

    def __str__(self):
        return f"{self.email} ({self.role})"

    @property
    def full_name(self):
        return f"{self.firstname} {self.lastname}"

    @property
    def student_profile(self):
        return getattr(self, 'student', None)


class EmailOTP(models.Model):
    """One-time 6-digit code emailed to a user. One live (unused, unexpired) row
    per email at a time — issuing a new one invalidates prior unused ones."""
    email      = models.EmailField(db_index=True)
    code       = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at    = models.DateTimeField(null=True, blank=True)
    attempts   = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=['email', '-created_at'])]

    def __str__(self):
        return f"OTP({self.email}, used={bool(self.used_at)})"


class PasswordResetOTP(models.Model):
    """6-digit code emailed for the forgot-password flow. Separate table from
    EmailOTP so the two flows can't interfere with each other (cooldowns,
    attempt counters, etc.). Verified rows are kept until confirm deletes them."""
    email      = models.EmailField(db_index=True)
    code       = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts   = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=['email', '-created_at'])]

    def __str__(self):
        return f"PasswordResetOTP({self.email})"