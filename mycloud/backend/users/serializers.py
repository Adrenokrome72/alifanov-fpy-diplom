# backend/users/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.db.models import Sum

User = get_user_model()

class UserListSerializer(serializers.ModelSerializer):
    # computed fields
    is_blocked = serializers.SerializerMethodField()
    storage_count = serializers.SerializerMethodField()
    storage_bytes = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff',
                  'is_blocked', 'storage_count', 'storage_bytes']

    def get_is_blocked(self, obj):
        # Using is_active inverted as "blocked" flag
        return not bool(getattr(obj, 'is_active', True))

    def get_storage_count(self, obj):
        try:
            # ожидается related_name='stored_files' в модели StoredFile
            return obj.stored_files.count()
        except Exception:
            return None

    def get_storage_bytes(self, obj):
        try:
            agg = obj.stored_files.aggregate(total=Sum('size'))
            return agg.get('total') or 0
        except Exception:
            return None
