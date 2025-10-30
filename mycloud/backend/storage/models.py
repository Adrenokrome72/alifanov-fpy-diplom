from django.db import models
from django.contrib.auth import get_user_model
import uuid
import os
from imagekit.models import ProcessedImageField
from imagekit.processors import ResizeToFit
from django.utils import timezone
from django.conf import settings

User = get_user_model()

class Folder(models.Model):
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='folders')
    created_at = models.DateTimeField(auto_now_add=True)
    child_count = models.IntegerField(default=0)  # Для кэша количества детей

    def update_child_count(self):
        self.child_count = self.children.count() + File.objects.filter(folder=self).count()
        self.save(update_fields=['child_count'])

class File(models.Model):
    original_name = models.CharField(max_length=255)
    unique_name = models.CharField(max_length=255, unique=True)
    size = models.BigIntegerField()
    comment = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    last_downloaded_at = models.DateTimeField(null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='files')
    folder = models.ForeignKey(Folder, null=True, blank=True, on_delete=models.SET_NULL, related_name='files')
    share_link = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    thumbnail = ProcessedImageField(upload_to='thumbnails/', processors=[ResizeToFit(100, 100)], format='JPEG', options={'quality': 60}, blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.unique_name:
            self.unique_name = f"{uuid.uuid4()}_{self.original_name}"
        super().save(*args, **kwargs)
        self.owner.update_used_storage()
        if self.folder:
            self.folder.update_child_count()

    def delete(self, *args, **kwargs):
        # Удаление файла с диска
        path = os.path.join(settings.MEDIA_ROOT, str(self.owner.id), self.unique_name)
        if os.path.exists(path):
            os.remove(path)
        if self.thumbnail:
            self.thumbnail.delete(save=False)
        super().delete(*args, **kwargs)
        self.owner.update_used_storage()
        if self.folder:
            self.folder.update_child_count()