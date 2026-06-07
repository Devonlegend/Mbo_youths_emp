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
    path('password/reset/request/', views.password_reset_request, name='password-reset-request'),
    path('password/reset/verify/',  views.password_reset_verify,  name='password-reset-verify'),
    path('password/reset/confirm/', views.password_reset_confirm, name='password-reset-confirm'),
    # Admin user management endpoints
    path('audit-logs/', views.audit_log_list, name='audit-logs'), 
    path('admin-users/', views.admin_users_list, name='admin-users'),  

    # NEW — admin users list for settings page
    
    path('admin-users/create/', views.admin_user_create, name='admin-user-create'),
    path('admin-users/<uuid:id>/role/', views.admin_user_update_role, name='admin-user-role'),
    path('admin-users/<uuid:id>/deactivate/', views.admin_user_deactivate, name='admin-user-deactivate'),
    path('admin-users/<uuid:id>/reactivate/', views.admin_user_reactivate, name='admin-user-reactivate'),

]