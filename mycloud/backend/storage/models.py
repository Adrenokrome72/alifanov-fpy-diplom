# backend/storage/models.py
import os
import uuid
import secrets
from django.db import models
from django.conf import settings
from django.utils import timezone

User = settings.AUTH_USER_MODEL  # обычно "auth.User"

def user_directory_path(instance, filename):
    # сохраняем под: files/<user_id>/<yyyymm>/<uuid>.<ext>
    ext = filename.split('.')[-1] if '.' in filename else ''
    ymd = timezone.now().strftime('%Y%m')
    unique = uuid.uuid4().hex
    stored_filename = f"{unique}.{ext}" if ext else unique
    return os.path.join('files', str(instance.owner.id), ymd, stored_filename)

def make_public_token():
    return secrets.token_urlsafe(24)

class StoredFile(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stored_files')
    original_name = models.CharField(max_length=512)
    stored_file = models.FileField(upload_to=user_directory_path)
    size = models.BigIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    last_downloaded_at = models.DateTimeField(null=True, blank=True)
    comment = models.TextField(blank=True)
    public_link_token = models.CharField(max_length=128, unique=True, null=True, blank=True)

    class Meta:
        ordering = ['-uploaded_at']

    def save(self, *args, **kwargs):
        # если файл загружен — обновим size
        if self.stored_file and not self.size:
            try:
                self.size = self.stored_file.size
            except Exception:
                pass
        # сгенерим токен, если требуется
        if self.public_link_token is None:
            self.public_link_token = None  # оставляем None — генерируем по запросу
        super().save(*args, **kwargs)

    def generate_public_link(self):
        if not self.public_link_token:
            self.public_link_token = make_public_token()
            self.save(update_fields=['public_link_token'])
        return self.public_link_token

    def increment_download(self):
        self.last_downloaded_at = timezone.now()
        self.save(update_fields=['last_downloaded_at'])
