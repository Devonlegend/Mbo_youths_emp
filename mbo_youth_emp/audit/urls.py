from django.urls import path
from .views import AuditLogView

urlpatterns = [
    path('', AuditLogView.as_view()),
]