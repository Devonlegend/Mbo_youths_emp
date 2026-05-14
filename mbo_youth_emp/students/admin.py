from django.contrib import admin
from .models import Student

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display =['full_name','ward','level','cgpa','is_verified',]
    list_filter =['ward','is_verified']
    search_fields= ['full_name','nin_hash']
