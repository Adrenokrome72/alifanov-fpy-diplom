# backend/storage/serializers.py
from rest_framework import serializers
from .models import StoredFile, Folder

class FolderSerializer(serializers.ModelSerializer):
    child_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Folder
        fields = ('id', 'name', 'parent', 'owner', 'child_count')
        read_only_fields = ('id', 'owner', 'child_count')

class StoredFileSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()
    public_link_token = serializers.CharField(read_only=True)
    folder = serializers.PrimaryKeyRelatedField(queryset=Folder.objects.all(), allow_null=True, required=False)

    class Meta:
        model = StoredFile
        fields = ('id', 'original_name', 'download_url', 'size', 'uploaded_at',
                  'folder', 'comment', 'download_count', 'public_link_token', 'last_downloaded_at', 'owner')
        read_only_fields = ('id', 'download_url', 'size', 'uploaded_at', 'download_count', 'public_link_token', 'last_downloaded_at', 'owner')

    def get_download_url(self, obj):
        request = self.context.get('request')
        if request:
            # use the download endpoint if you have one; otherwise direct file URL
            # We'll provide direct file URL (Django MEDIA serve) for convenience
            if obj.stored_file:
                return request.build_absolute_uri(obj.stored_file.url)
        # fallback
        return getattr(obj, 'stored_file', None) and getattr(obj.stored_file, 'url', None)
