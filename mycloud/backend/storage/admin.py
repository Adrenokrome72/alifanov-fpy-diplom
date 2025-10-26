from django.contrib import admin
from .models import StoredFile, Folder

@admin.register(Folder)
class FolderAdmin(admin.ModelAdmin):
    list_display = ('id','name','owner','parent','created_at')

@admin.register(StoredFile)
class StoredFileAdmin(admin.ModelAdmin):
    list_display = ('id','original_name','owner','size','uploaded_at','folder')
