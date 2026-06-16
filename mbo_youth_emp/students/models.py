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

class Student(models.Model):
    # primary_key=True so the Student row reuses the User's UUID as its PK —
    # student.pk == user.id, matching the contract the register view relies on.
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='student')
    firstname    = models.CharField(max_length=50, blank=True, default='')
    lastname     = models.CharField(max_length=50, blank=True, default='')
    cgpa = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    level = models.IntegerField(null=True, blank=True)
    is_verified = models.BooleanField(default=True)
    active_award = models.CharField(max_length=300, blank=True)
    nin_hash = models.CharField(max_length=20, blank=True, default='')
    lga = models.CharField(max_length=80, blank=True)
    passport = models.FileField(null=True, blank=True)
    ward        = models.CharField(max_length=40, blank=True)
    date_of_birth = models.DateField(null=True)
    certificate = models.FileField(null=True, blank=True)

    def __str__(self):
        return f"{self.firstname} {self.lastname} - {self.is_verified}"

    @property
    def full_name(self):
        return f"{self.firstname} {self.lastname}"

    def has_active_award(self):
        return bool(self.active_award)


class AcademicRecord(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='academic_records')
    institution_name = models.CharField(max_length=100)
    course_of_study = models.CharField(max_length=100)
    current_level = models.CharField(max_length=100)
    cgpa = models.DecimalField(max_digits=4, decimal_places=2, null=True)
    admission_year = models.IntegerField(null=True, blank=True)