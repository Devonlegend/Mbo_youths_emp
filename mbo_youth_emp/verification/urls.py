from django.urls import path
from . import views

urlpatterns = [
    path('bank/',  views.resolve_bank_account, name='resolve-bank'),
    path('banks/', views.get_banks,            name='get-banks'),
]
