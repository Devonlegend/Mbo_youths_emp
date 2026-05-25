import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    STUDENT   = 'student',   'Student'
    VERIFIER  = 'verifier',  'Verification Officer'
    ADMIN     = 'admin',     'LGA Administrator'
    SUPERADMIN = 'superadmin', 'Super Administrator'


class UserManager(BaseUserManager):
    def create_user(self, email, firstname, lastname, phone_number, role, nin_hash, password=None):
        if not email:
            raise ValueError("Email is required")
        user = self.model(
            email=self.normalize_email(email),
            firstname=firstname,
            lastname=lastname,
            phone_number=phone_number,
            role=role,
            nin_hash=nin_hash
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, firstname, lastname,nin_hash, phone_number, password):
        user = self.create_user(email, firstname, lastname, phone_number, Role.SUPERADMIN, nin_hash, password)
        user.is_staff     = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email        = models.EmailField(unique=True)
    gender = models.CharField(max_length=10,default='male', choices=[('male', 'Male'), ('female', 'Female')])
    phone_number = models.CharField(max_length=15, unique=True)
    ward        = models.CharField(max_length=40, blank=True)
    role         = models.CharField(max_length=20, choices=Role.choices)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)
    firstname    = models.CharField(max_length=50, default="new user" )
    lastname     = models.CharField(max_length=50, default="new user" )
    nin_hash     = models.CharField(max_length=20, default="00000000000", unique=True, null=False, blank=False)

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