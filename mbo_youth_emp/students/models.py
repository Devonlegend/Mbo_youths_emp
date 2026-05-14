from django.db import models
import uuid

WARD_CHOICES = [
    ('effiat','Effiat'),
    ('ewang','Ewang'),
    ('ebughu','Ebughu'),
    ('uda','Uda'),
    ('unyene','Unyene'),
    




]
class Students(models.Model):
    id = models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    full_name = models.CharField(max_length=250)
    ward = models.CharField(max_length=40)
    nin_hash = models.CharField(max_length=64,unique=True)
    cgpa = models.DecimalField(max_digits=4, decimal_places=2, null=True ,blank=True)
    level = models.IntegerField(max_length=10)
    is_verified = models.BooleanField(default=False)
    active_award = models.CharField(max_length=300 ,blank = True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_At = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.full_name} -{self.ward}"
    def has_active_award(self):
        return bool(self.active_award)