from django.urls import path
from . import views

urlpatterns= [
    path('',views.students_list, name='student-list'),
    path('<uuid:student_id>/',views.student_detail, name='student-detail')
]