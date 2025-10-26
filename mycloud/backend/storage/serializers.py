# backend/storage/serializers.py
from rest_framework import serializers
from .models import StoredFile, Folder
from django.contrib.auth import get_user_model

User = get_user_model()

class FolderSerializer(serializers.ModelSerializer):
    child_count = serializers.SerializerMethodField()
    owner_id = serializers.IntegerField(source='owner.id', read_only=True)

    class Meta:
        model = Folder
        fields = ['id', 'name', 'parent', 'owner_id', 'child_count']
        read_only_fields = ('id', 'owner_id', 'child_count')

    def get_child_count(self, obj):
        try:
            return obj.files.count()
        except Exception:
            return 0

class StoredFileSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()
    public_link_token = serializers.CharField(read_only=True)

    class Meta:
        model = StoredFile
        fields = [
            'id', 'original_name', 'size', 'uploaded_at', 'last_downloaded_at',
            'comment', 'download_url', 'public_link_token', 'folder',
        ]
        read_only_fields = ('id', 'size', 'uploaded_at', 'last_downloaded_at', 'download_url', 'public_link_token')

    def get_download_url(self, obj):
        request = self.context.get('request')
        if not request:
            return obj.get_download_url() if hasattr(obj, 'get_download_url') else None
        return request.build_absolute_uri(obj.get_download_url())
