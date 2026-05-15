from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/',views.register, name='register'),
    path('login/', views.login, name='login'),
    path('me/', views.me, name='me'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('logout/', views.logout, name='logout'),
]