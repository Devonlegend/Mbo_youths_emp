from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('otp/send/', views.otp_send, name='otp-send'),
    path('otp/verify/', views.otp_verify, name='otp-verify'),
    path('otp/resend/', views.otp_resend, name='otp-resend'),
    path('me/', views.me, name='me'),
    path('token/refresh/', views.refresh_token, name='token-refresh'),
    path('logout/', views.logout, name='logout'),
]