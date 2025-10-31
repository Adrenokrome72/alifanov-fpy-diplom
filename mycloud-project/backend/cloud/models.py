# backend/cloud/models.py
import os
import uuid
from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.dispatch import receiver
from django.db.models.signals import post_delete, post_save
from django.core.validators import MinValueValidator

User = get_user_model()

def user_file_upload_to(instance, filename):
    """
    Формирует путь: user_<owner_id>/folder_<folder_id or root>/<uuid4><ext>
    """
    ext = os.path.splitext(filename)[1]
    owner_id = getattr(instance, "owner_id", None) or (instance.owner.pk if instance.owner and instance.owner.pk else "anonymous")
    folder_part = "root"
    if getattr(instance, "folder", None):
        folder_part = f"folder_{instance.folder.pk}"
    unique_name = uuid.uuid4().hex + ext
    return os.path.join(f"user_{owner_id}", folder_part, unique_name)

class UserProfile(models.Model):
    """
    Профиль пользователя: хранит квоту и отображаемое полное имя.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=255, blank=True)
    quota = models.BigIntegerField(default=settings.USER_DEFAULT_QUOTA, validators=[MinValueValidator(0)])  # байты

    def __str__(self):
        return f"profile:{self.user.username}"

    def get_used_bytes(self):
        # суммируем size у всех файлов пользователя
        return int(self.user.files.aggregate(total=models.Sum("size"))["total"] or 0)

    def remaining_bytes(self):
        used = self.get_used_bytes()
        return max(0, self.quota - used)

class Folder(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="folders")
    name = models.CharField(max_length=255)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("owner", "parent", "name")
        ordering = ("-created_at", "name")

    def __str__(self):
        return f"{self.name} (owner={self.owner_id})"

    def get_path(self):
        parts = []
        node = self
        while node:
            parts.append(node.name)
            node = node.parent
        return "/".join(reversed(parts))

class UserFile(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="files")
    folder = models.ForeignKey(Folder, on_delete=models.CASCADE, related_name="files", null=True, blank=True)
    original_name = models.CharField(max_length=1024)
    file = models.FileField(upload_to=user_file_upload_to)
    size = models.BigIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    last_downloaded_at = models.DateTimeField(null=True, blank=True)
    comment = models.TextField(blank=True)
    is_shared = models.BooleanField(default=False)
    share_token = models.CharField(max_length=64, unique=True, null=True, blank=True)

    class Meta:
        ordering = ("-uploaded_at",)

    def __str__(self):
        return f"{self.original_name} (owner={self.owner_id})"

    def save(self, *args, **kwargs):
        # Если файл новый и нет original_name, поставить
        if not self.original_name and self.file:
            self.original_name = os.path.basename(self.file.name)
        super().save(*args, **kwargs)
        # Обновим размер (если файл доступен)
        try:
            if self.file and hasattr(self.file, "size"):
                if self.size != self.file.size:
                    self.size = self.file.size
                    super().save(update_fields=["size"])
        except Exception:
            pass

    def generate_share_token(self):
        self.share_token = uuid.uuid4().hex
        self.is_shared = True
        self.save(update_fields=["share_token", "is_shared"])
        return self.share_token

    def revoke_share(self):
        self.share_token = None
        self.is_shared = False
        self.save(update_fields=["share_token", "is_shared"])

    def mark_downloaded(self):
        self.last_downloaded_at = timezone.now()
        self.save(update_fields=["last_downloaded_at"])

    def rename(self, new_name):
        self.original_name = new_name
        self.save(update_fields=["original_name"])

# удаляем файл с диска при удалении записи
@receiver(post_delete, sender=UserFile)
def delete_file_on_record_delete(sender, instance, **kwargs):
    try:
        if instance.file:
            storage = instance.file.storage
            if storage.exists(instance.file.name):
                storage.delete(instance.file.name)
    except Exception:
        pass

# Создаём профиль при создании пользователя
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        # создаём профиль с дефолтной квотой, имя пустое
        UserProfile.objects.create(user=instance, quota=settings.USER_DEFAULT_QUOTA)
