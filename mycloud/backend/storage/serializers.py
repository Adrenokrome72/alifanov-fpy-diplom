# backend/storage/serializers.py
from rest_framework import serializers
from django.utils import timezone
from .models import Folder, StoredFile

class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ['id', 'name', 'parent', 'owner', 'created_at', 'child_count']
        read_only_fields = ['owner', 'created_at', 'child_count']

    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Name cannot be empty")
        return value

class StoredFileSerializer(serializers.ModelSerializer):
    # stored_file will be uploaded (FileField). owner is read-only (set from request)
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    stored_file = serializers.FileField(required=True)
    thumbnail = serializers.CharField(read_only=True)

    class Meta:
        model = StoredFile
        fields = (
            'id', 'name', 'stored_file', 'folder', 'owner',
            'uploaded_at', 'size', 'is_shared_public', 'thumbnail'
        )
        read_only_fields = ('id', 'owner', 'uploaded_at', 'size', 'thumbnail')

    def validate(self, attrs):
        # make sure folder belongs to same owner if provided (defensive)
        folder = attrs.get('folder', None)
        request = self.context.get('request')
        if folder and request and hasattr(request, 'user') and folder.owner != request.user:
            raise serializers.ValidationError({'folder': 'Folder does not belong to the authenticated user.'})
        return attrs

    def create(self, validated_data):
        # set owner from context request
        request = self.context.get('request', None)
        owner = getattr(request, 'user', None)
        stored_file = validated_data.pop('stored_file')
        name = validated_data.get('name') or stored_file.name.split('/')[-1]
        folder = validated_data.get('folder', None)

        obj = StoredFile(
            name=name,
            stored_file=stored_file,
            folder=folder,
            owner=owner,
        )
        # compute size if file provides it
        try:
            stored_file.seek(0, 2)
            obj.size = stored_file.tell()
            stored_file.seek(0)
        except Exception:
            # fallback, DB default remains
            pass
        obj.uploaded_at = timezone.now()
        obj.save()
        return obj
