from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
# Registered before the award routes so /awards/installments/... and
# /awards/appeals/... are matched before the award detail route /awards/<pk>/.
router.register(r'installments', views.InstallmentViewSet, basename='award-installment')
router.register(r'appeals', views.AppealViewSet, basename='award-appeal')
router.register(r'', views.AwardViewSet, basename='award')

urlpatterns = [
    path('', include(router.urls)),
]
