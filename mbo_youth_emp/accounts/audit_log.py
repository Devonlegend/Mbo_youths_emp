from django.db import models
import uuid

class AuditLog(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin       = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    action      = models.TextField()
    entity_type = models.CharField(max_length=50)  # "Application", "Scheme", "Student"
    entity_id   = models.CharField(max_length=100, blank=True)
    timestamp   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} — {self.timestamp}"