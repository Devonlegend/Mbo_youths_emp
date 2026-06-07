from django.urls import path
from . import views

urlpatterns = [
    path('',              views.list_notifications),
    path('read-all/',     views.mark_all_read),
    path('<uuid:id>/read/',   views.mark_read),
    path('<uuid:id>/',        views.dismiss),
    path('clear/',        views.clear_all),
]