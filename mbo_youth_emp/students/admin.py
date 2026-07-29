from django.contrib import admin
from .models import Student

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display =['email','firstname','lastname','ward','level','cgpa','is_verified',]
    list_filter =['ward','is_verified']
    search_fields= ['firstname','lastname','nin_hash']


