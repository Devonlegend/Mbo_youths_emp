from django.contrib import admin
from .models import Students

@admin.register(Students)
class StudentAdmin(admin.ModelAdmin):
    list_display =['full_name','ward']
