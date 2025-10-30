from django.db import models
from django.contrib.auth import get_user_model
import uuid
from django.conf import settings
import os

User = get_user_model()

class Folder(models.Model):
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    child_count = models.IntegerField(default=0)

    def update_child_count(self):
        self.child_count = self.children.count() + File.objects.filter(folder=self).count()
        self.save()

    class Meta:
        unique_together = ['name', 'parent', 'owner']

class File(models.Model):
    original_name = models.CharField(max_length=255)
    unique_name = models.CharField(max_length=255, unique=True, default=uuid.uuid4)
    size = models.BigIntegerField()
    comment = models.TextField(blank=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    folder = models.ForeignKey(Folder, null=True, blank=True, on_delete=models.SET_NULL)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    last_downloaded_at = models.DateTimeField(null=True, blank=True)
    share_link = models.UUIDField(default=uuid.uuid4, unique=True)
    thumbnail = models.ImageField(upload_to='thumbnails', null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.unique_name:
            self.unique_name = str(uuid.uuid4())  # Ensure string
        super().save(*args, **kwargs)