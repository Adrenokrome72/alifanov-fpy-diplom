# backend/cloud/serializers.py
import re
from django.contrib.auth import get_user_model, authenticate
from django.core.validators import validate_email
from django.db.models import Sum
from rest_framework import serializers
from .models import Folder, UserFile, UserProfile

User = get_user_model()

USERNAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]{3,19}$")
PASSWORD_RE = re.compile(r"^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$")

class RegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    full_name = serializers.CharField(max_length=255, allow_blank=True, required=False)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_username(self, value):
        if not USERNAME_RE.match(value):
            raise serializers.ValidationError("Username must start with a letter, contain only Latin letters and digits, length 4-20.")
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        try:
            validate_email(value)
        except Exception:
            raise serializers.ValidationError("Invalid email address.")
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def validate_password(self, value):
        if not PASSWORD_RE.match(value):
            raise serializers.ValidationError("Password must be at least 6 characters, include an uppercase letter, a digit and a special character.")
        return value

    def create(self, validated_data):
        username = validated_data["username"]
        email = validated_data["email"]
        password = validated_data["password"]
        full_name = validated_data.get("full_name", "")
        user = User.objects.create_user(username=username, email=email)
        user.set_password(password)
        user.save()
        # profile will be created by signal; update full_name
        profile = getattr(user, "profile", None)
        if profile:
            profile.full_name = full_name
            profile.save(update_fields=["full_name"])
        else:
            UserProfile.objects.create(user=user, full_name=full_name)
        return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs.get("username"), password=attrs.get("password"))
        if not user:
            raise serializers.ValidationError("Invalid username or password.")
        attrs["user"] = user
        return attrs

class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ["id", "owner", "name", "parent", "created_at"]
        read_only_fields = ["id", "owner", "created_at"]

class UserFileSerializer(serializers.ModelSerializer):
    file = serializers.FileField(required=True)
    download_url = serializers.SerializerMethodField(read_only=True)
    share_url = serializers.SerializerMethodField(read_only=True)
    original_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = UserFile
        fields = [
            "id",
            "owner",
            "folder",
            "original_name",
            "file",
            "size",
            "uploaded_at",
            "last_downloaded_at",
            "comment",
            "is_shared",
            "share_token",
            "download_url",
            "share_url",
        ]
        read_only_fields = ["id", "owner", "size", "uploaded_at", "last_downloaded_at", "share_token", "download_url", "share_url"]

    def get_download_url(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        return request.build_absolute_uri(f"/api/files/{obj.pk}/download/")

    def get_share_url(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        if obj.is_shared and obj.share_token:
            return request.build_absolute_uri(f"/api/external/download/{obj.share_token}/")
        return None

class AdminUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    quota = serializers.SerializerMethodField()
    files_count = serializers.SerializerMethodField()
    files_size = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "is_staff",
            "is_active",
            "full_name",
            "quota",
            "files_count",
            "files_size",
        ]
        read_only_fields = ["id", "username", "email", "files_count", "files_size", "full_name"]

    def get_full_name(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.full_name if profile else ""

    def get_quota(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.quota if profile else None

    def get_files_count(self, obj):
        # efficient count
        return obj.files.count()

    def get_files_size(self, obj):
        ag = obj.files.aggregate(total=Sum("size"))
        return int(ag["total"] or 0)