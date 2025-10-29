# backend/storage/models.py
import os
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone

User = settings.AUTH_USER_MODEL

def user_directory_path(instance, filename):
    """
    Upload path for files:
    media/user_<owner_id>/folder_<folder_id or root>/<uuid4>__originalname
    """
    owner_id = getattr(instance, 'owner_id', None) or getattr(instance.owner, 'id', 'anon')
    folder_part = 'root'
    if getattr(instance, 'folder_id', None):
        folder_part = f'folder_{instance.folder_id}'
    safe_name = filename.replace('/', '_').replace('\\', '_')
    uid = uuid.uuid4().hex
    return os.path.join(f'user_{owner_id}', folder_part, f'{uid}__{safe_name}')

class Folder(models.Model):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='folders')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ('owner', 'parent', 'name')  # avoid duplicate same-name sibling folders

    def __str__(self):
        return f"{self.name} ({self.owner})"

    @property
    def child_count(self):
        return self.children.count() + self.files.count()

class StoredFile(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='files')
    original_name = models.CharField(max_length=1024)
    stored_file = models.FileField(upload_to=user_directory_path)
    size = models.BigIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    folder = models.ForeignKey(Folder, null=True, blank=True, on_delete=models.SET_NULL, related_name='files')
    comment = models.TextField(blank=True, default='')
    download_count = models.IntegerField(default=0)
    public_link_token = models.CharField(max_length=64, null=True, blank=True, unique=True)
    last_downloaded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.original_name} ({self.owner})"

    def save(self, *args, **kwargs):
        # try to set size if file provided
        try:
            if self.stored_file and hasattr(self.stored_file, 'size'):
                self.size = self.stored_file.size
        except Exception:
            pass
        super().save(*args, **kwargs)

    def increment_download(self):
        self.download_count = (self.download_count or 0) + 1
        self.last_downloaded_at = timezone.now()
        self.save(update_fields=['download_count', 'last_downloaded_at'])

    def generate_public_link(self):
        # create a unique token
        token = uuid.uuid4().hex
        self.public_link_token = token
        self.save(update_fields=['public_link_token'])
        return token
