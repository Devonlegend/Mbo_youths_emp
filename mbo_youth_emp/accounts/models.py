import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    STUDENT   = 'student',   'Student'
    VERIFIER  = 'verifier',  'Verification Officer'
    ADMIN     = 'admin',     'LGA Administrator'
    SUPERADMIN = 'superadmin', 'Super Administrator'


class UserManager(BaseUserManager):
    def create_user(self, email, phone_number, role, password=None):
        if not email:
            raise ValueError("Email is required")
        user = self.model(
            email=self.normalize_email(email),
            phone_number=phone_number,
            role=role,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, phone_number, password):
        user = self.create_user(email, phone_number, Role.SUPERADMIN, password)
        user.is_staff     = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email        = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=15, unique=True)
    role         = models.CharField(max_length=20, choices=Role.choices)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['phone_number']

    def __str__(self):
        return f"{self.email} ({self.role})"