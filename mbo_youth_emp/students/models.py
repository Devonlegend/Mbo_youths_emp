from django.db import models
import uuid
from django.conf import settings
from accounts.models import User

WARD_CHOICES = [
    ('efiat','Efiat'),
    ('efiat II','Efiat II'),
    ('enwang I','Enwang I'),
    ('enwang II','Enwang II'),
    ('ebughu I','Ebughu I'),
    ('ebughu II','Ebughu II'),
    ('ibaka','Ibaka'),
    ('uda I','Uda I'),
    ('uda II','Uda II'),
    ('udesi','Udesi'),
]

class Student(User):
    # parent_link=True makes this THE parent-link column of the MTI relation:
    # students.user_ptr_id == users.id, so student.pk == user.id and
    # request.user.student / student.user both resolve to the same row.
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='student',
        parent_link=True,
    )
    is_verified = models.BooleanField(default=False)
    verification_rejection_reason = models.TextField(blank=True, default='')
    verification_reviewed_at = models.DateTimeField(null=True, blank=True)
    active_award = models.CharField(max_length=300, blank=True)
    nin_slip = models.FileField(null=True,blank=True)
    lga = models.CharField(max_length=80, blank=True)
    ward        = models.CharField(max_length=40, blank=True)
    certificate = models.FileField(null=True, blank=True)
    bank_name = models.CharField(max_length=100, blank=True, default='')
    bank_code = models.CharField(max_length=10, blank=True, default='')
    bank_account_number = models.CharField(max_length=10, blank=True, default='')
    bank_account_name = models.CharField(max_length=150, blank=True, default='')

    def __str__(self):
        return f"{self.firstname} {self.lastname} - {self.is_verified}"

    @property
    def full_name(self):
        return f"{self.firstname} {self.lastname}"

    def has_active_award(self):
        return bool(self.active_award)

    @classmethod
    def attach_to_user(cls, user, **student_fields):
        """Create the Student (child) row for an already-persisted User.

        With multi-table inheritance the parent User row already exists, so a
        plain save() would force a duplicate parent INSERT (Django force-inserts
        any new instance whose PK has a default). save_base(raw=True) skips that
        and only writes the child table, leaving the User row untouched.
        """
        student = cls(user=user, **student_fields)
        student.save_base(raw=True)
        return student

