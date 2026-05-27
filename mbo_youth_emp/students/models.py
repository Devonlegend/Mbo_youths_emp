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
    cgpa = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    level = models.IntegerField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    active_award = models.CharField(max_length=300, blank=True)
    lga = models.CharField(max_length=80, blank=True)
    passport = models.FileField(null=True, blank=True)
    state_of_origin = models.FileField(null=True, blank=True)

    def __str__(self):
        return f"{self.firstname} {self.lastname} - {self.is_verified}"

    def has_active_award(self):
        return bool(self.active_award)


class AcademicRecord(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='academic_records')
    institution_name = models.CharField(max_length=100)
    course_of_study = models.CharField(max_length=100)
    current_level = models.CharField(max_length=100)
    cgpa = models.DecimalField(max_digits=4, decimal_places=2, null=True)
    admission_year = models.IntegerField(null=True, blank=True)