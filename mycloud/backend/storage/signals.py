# backend/storage/signals.py
import os
from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import StoredFile

@receiver(post_delete, sender=StoredFile)
def delete_file_from_storage(sender, instance, **kwargs):
    try:
        if instance.stored_file:
            path = instance.stored_file.path
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    # don't crash on failure
                    pass
    except Exception:
        pass
