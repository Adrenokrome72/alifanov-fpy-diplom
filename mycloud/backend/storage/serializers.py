from rest_framework import serializers
from .models import Folder, File

class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ['id', 'name', 'parent', 'owner', 'created_at', 'child_count']
        read_only_fields = ['owner', 'created_at', 'child_count']

    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Name cannot be empty")
        return value

    def validate_parent(self, value):
        if value is not None:
            if value.owner != self.context['request'].user:
                raise serializers.ValidationError("Invalid parent folder")
        return value

class FileSerializer(serializers.ModelSerializer):
    class Meta:
        model = File
        fields = ['id', 'original_name', 'size', 'comment', 'uploaded_at', 'last_downloaded_at', 'share_link', 'thumbnail', 'folder']
        read_only_fields = ['owner', 'uploaded_at', 'last_downloaded_at', 'share_link', 'thumbnail']

    def validate_folder(self, value):
        if value is not None:
            if value.owner != self.context['request'].user:
                raise serializers.ValidationError("Invalid folder")
        return value