from django.contrib import admin

from . import models 

# Register you@r models here.

@admin.register(models.User)
class UserAdmin(admin.ModelAdmin):
    pass