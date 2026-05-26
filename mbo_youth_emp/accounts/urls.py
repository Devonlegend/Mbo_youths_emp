from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('me/', views.me, name='me'),
    path('token/refresh/', views.refresh_token, name='token-refresh'),
    path('logout/', views.logout, name='logout'),
]