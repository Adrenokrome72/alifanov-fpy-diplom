# backend/storage/serializers.py
from rest_framework import serializers
from .models import StoredFile

class StoredFileSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()
    class Meta:
        model = StoredFile
        fields = ['id','original_name','size','uploaded_at','last_downloaded_at','comment','public_link_token','download_url']

    def get_download_url(self, obj):
        request = self.context.get('request')
        if obj.public_link_token:
            return request.build_absolute_uri(f"/api/storage/public/{obj.public_link_token}/download/")
        # authenticated download:
        return request.build_absolute_uri(f"/api/storage/files/{obj.id}/download/")
