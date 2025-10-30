from django.contrib import admin
from .models import Folder, File

@admin.register(Folder)
class FolderAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'parent', 'created_at', 'child_count')
    list_filter = ('owner',)
    search_fields = ('name',)

@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ('original_name', 'owner', 'folder', 'size', 'uploaded_at', 'last_downloaded_at')
    list_filter = ('owner', 'folder')
    search_fields = ('original_name',)