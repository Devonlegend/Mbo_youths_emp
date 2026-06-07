import uuid
from django.db import models
from accounts.models import User

class Notification(models.Model):
    TYPE_CHOICES = [
        ('application', 'Application'),
        ('deadline',    'Deadline'),
        ('programme',   'Programme'),
        ('profile',     'Profile'),
        ('system',      'System'),
        ('alert',       'Alert'),
        ('welcome',     'Welcome'),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title      = models.CharField(max_length=200)
    message    = models.TextField()
    type       = models.CharField(max_length=20, choices=TYPE_CHOICES, default='system')
    read       = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} — {self.title}"