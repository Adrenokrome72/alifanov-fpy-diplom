# users/serializers.py
import re
from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.db import models

User = get_user_model()

USERNAME_RE = re.compile(r'^[A-Za-z][A-Za-z0-9._-]{3,19}$')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'first_name', 'last_name')

    def validate_username(self, v):
        if not USERNAME_RE.match(v):
            raise serializers.ValidationError(
                "Username must start with a letter, contain only letters/numbers/._- and be 4..20 chars long"
            )
        return v

    def create(self, validated_data):
        # using create_user to hash password etc.
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email') or '',
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

class AdminUserSerializer(serializers.ModelSerializer):
    # computed fields
    storage_count = serializers.SerializerMethodField()
    storage_bytes = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name',
                  'is_staff', 'is_superuser', 'is_blocked',
                  'storage_count', 'storage_bytes')

    def get_storage_count(self, obj):
        # avoid circular import at module load
        try:
            from storage.models import StoredFile
            return StoredFile.objects.filter(owner=obj).count()
        except Exception:
            return 0

    def get_storage_bytes(self, obj):
        try:
            from storage.models import StoredFile
            agg = StoredFile.objects.filter(owner=obj).aggregate(total=models.Sum('size'))['total']
            return agg or 0
        except Exception:
            return 0

    def get_is_blocked(self, obj):
        # safe access: if no profile exists, treat as not blocked
        return bool(getattr(getattr(obj, 'profile', None), 'is_blocked', False))

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'email', 'password']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user