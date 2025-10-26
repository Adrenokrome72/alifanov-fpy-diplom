# backend/storage/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid
import os

def storage_file_path(instance, filename):
    # store in MEDIA_ROOT/files/<user_id>/<uuid4>_<original>
    uid = getattr(instance.owner, 'id', 'anon')
    name = f"{uuid.uuid4().hex}_{filename}"
    return os.path.join('files', str(uid), name)

class Folder(models.Model):
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name='folders')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class StoredFile(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='stored_files')
    original_name = models.CharField(max_length=1024)
    stored_file = models.FileField(upload_to=storage_file_path)
    size = models.BigIntegerField(null=True, blank=True)
    comment = models.TextField(blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    last_downloaded_at = models.DateTimeField(null=True, blank=True)
    folder = models.ForeignKey(Folder, null=True, blank=True, on_delete=models.SET_NULL, related_name='files')
    public_link_token = models.CharField(max_length=64, blank=True, null=True)

    def save(self, *args, **kwargs):
        # try to set size automatically
        try:
            if self.stored_file and not self.size:
                self.size = self.stored_file.size
        except Exception:
            pass
        super().save(*args, **kwargs)

    def generate_public_link(self):
        if not self.public_link_token:
            self.public_link_token = uuid.uuid4().hex
            self.save(update_fields=['public_link_token'])
        return self.public_link_token

    def increment_download(self):
        self.last_downloaded_at = timezone.now()
        self.save(update_fields=['last_downloaded_at'])

    def get_download_url(self):
        # this returns the API path; serializer will turn it into absolute
        return f"/api/storage/files/{self.pk}/download/"

    def __str__(self):
        return f"{self.original_name} ({self.owner})"
