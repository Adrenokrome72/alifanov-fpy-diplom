# backend/users/models.py
from django.db import models
from django.conf import settings
from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    full_name = models.CharField(max_length=200, blank=True)
    is_admin_flag = models.BooleanField(default=False)  # дополнительный флаг, если нужно
    storage_path = models.CharField(max_length=512, blank=True)

    def __str__(self):
        return f"Profile({self.user.username})"
