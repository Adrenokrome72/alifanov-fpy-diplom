# backend/storage/apps.py
from django.apps import AppConfig

class StorageConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'storage'

    def ready(self):
        # import signals
        try:
            import storage.signals  # noqa
        except Exception:
            pass
