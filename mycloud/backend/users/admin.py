from django.contrib import admin
from .models import CustomUser

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_blocked', 'storage_limit', 'used_storage')
    list_filter = ('is_staff', 'is_blocked')
    search_fields = ('username', 'email')