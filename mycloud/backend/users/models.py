from django.db import models
from django.contrib.auth.models import AbstractUser

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    is_blocked = models.BooleanField(default=False)
    storage_limit = models.BigIntegerField(default=100 * 1024 * 1024)  # 100MB
    used_storage = models.BigIntegerField(default=0)
    can_upload = models.BooleanField(default=True)
    can_download = models.BooleanField(default=True)
    can_view = models.BooleanField(default=True)

    def update_used_storage(self):
        from storage.models import File
        total = File.objects.filter(owner=self).aggregate(models.Sum('size'))['size__sum'] or 0
        self.used_storage = total
        self.save(update_fields=['used_storage'])