# backend/storage/management/commands/cleanup_orphan_files.py
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from storage.models import StoredFile

class Command(BaseCommand):
    help = "Scan MEDIA_ROOT for files without DB record or DB pointing to missing files."

    def handle(self, *args, **options):
        media_root = settings.MEDIA_ROOT
        # all referenced paths
        db_paths = set()
        for s in StoredFile.objects.all():
            if s.stored_file and s.stored_file.name:
                db_paths.add(os.path.join(media_root, s.stored_file.name))
        # find all files on disk under MEDIA_ROOT/user_files
        removed = 0
        orphan = []
        for root, dirs, files in os.walk(os.path.join(media_root, "user_files")):
            for f in files:
                full = os.path.join(root, f)
                if full not in db_paths:
                    orphan.append(full)
        if orphan:
            self.stdout.write(f"Found {len(orphan)} orphan files. Deleting...")
            for p in orphan:
                try:
                    os.remove(p)
                    removed += 1
                except Exception as e:
                    self.stderr.write(f"Failed to delete {p}: {e}")
        # verify DB pointing to missing files
        missing_db = StoredFile.objects.filter(stored_file__isnull=False)
        missing_count = 0
        for s in missing_db:
            try:
                p = s.stored_file.path
                if not os.path.exists(p):
                    s.delete()
                    missing_count += 1
            except Exception:
                pass
        self.stdout.write(f"Deleted {removed} orphan files, removed {missing_count} DB entries.")
