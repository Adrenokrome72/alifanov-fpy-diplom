from django.contrib import admin
from .models import StoredFile

@admin.register(StoredFile)
class StoredFileAdmin(admin.ModelAdmin):
    list_display = ('id','original_name','owner','size','uploaded_at','last_downloaded_at')
    search_fields = ('original_name','owner__username')
