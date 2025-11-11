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

        user = User.objects.create_user(username=username, email=email, password=password)

        # profile is created by signal; update full_name if profile exists
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


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email")


class UserProfileSerializer(serializers.ModelSerializer):
    used_bytes = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ("id", "quota", "used_bytes", "full_name")

    def get_used_bytes(self, obj):
        try:
            return obj.get_used_bytes()
        except Exception:
            try:
                ag = obj.user.files.aggregate(total=Sum("size"))
                return int(ag["total"] or 0)
            except Exception:
                return 0


class FolderSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    owner_username = serializers.SerializerMethodField()
    owner_full_name = serializers.SerializerMethodField()
    files_count = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()  # Добавляем поле children
    files = serializers.SerializerMethodField()     # Добавляем поле files

    class Meta:
        model = Folder
        fields = (
            "id",
            "name",
            "parent",
            "owner",
            "owner_username",
            "owner_full_name",
            "created_at",
            "share_token",
            "files_count",
            "children_count",
            "children",
            "files",
        )

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else None

    def get_owner_full_name(self, obj):
        try:
            profile = getattr(obj.owner, "profile", None)
            if profile and profile.full_name:
                return profile.full_name
        except Exception:
            pass
        return getattr(obj.owner, "first_name", None) or getattr(obj.owner, "username", None)

    def get_files_count(self, obj):
        try:
            return obj.files.count()
        except Exception:
            return 0

    def get_children_count(self, obj):
        try:
            return obj.children.count()
        except Exception:
            return 0
        
    def get_children(self, obj):
        """Получаем непосредственных детей папки"""
        children = Folder.objects.filter(parent=obj).order_by("name")
        return FolderSerializer(children, many=True, context=self.context).data

    def get_files(self, obj):
        """Получаем файлы в этой папке"""
        files = UserFile.objects.filter(folder=obj).order_by("-uploaded_at")
        return UserFileSerializer(files, many=True, context=self.context).data


class UserFileSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    owner_username = serializers.SerializerMethodField()
    owner_full_name = serializers.SerializerMethodField()
    downloads_count = serializers.SerializerMethodField()

    class Meta:
        model = UserFile
        fields = (
            "id",
            "original_name",
            "comment",
            "size",
            "uploaded_at",
            "last_downloaded_at",
            "downloads_count",
            "share_token",
            "owner",
            "owner_username",
            "owner_full_name",
            "folder",
            "file",
        )
        read_only_fields = ("id", "uploaded_at", "last_downloaded_at", "downloads_count", "share_token", "owner")

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else None

    def get_owner_full_name(self, obj):
        try:
            profile = getattr(obj.owner, "profile", None)
            if profile and profile.full_name:
                return profile.full_name
        except Exception:
            pass
        name = ""
        if getattr(obj.owner, "first_name", None):
            name = obj.owner.first_name
        else:
            name = obj.owner.username if obj.owner else None
        return name

    def get_downloads_count(self, obj):
        try:
            return int(obj.download_count or 0)
        except Exception:
            return 0


class AdminUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    quota = serializers.SerializerMethodField()
    files_count = serializers.SerializerMethodField()
    files_size = serializers.SerializerMethodField()
    storage_url = serializers.SerializerMethodField()

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
            "storage_url",
        ]
        read_only_fields = ["id", "username", "email", "files_count", "files_size", "full_name", "storage_url"]

    def get_full_name(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.full_name if profile else ""

    def get_quota(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.quota if profile else None

    def get_files_count(self, obj):
        try:
            return obj.files.count()
        except Exception:
            return 0

    def get_files_size(self, obj):
        ag = obj.files.aggregate(total=Sum("size"))
        return int(ag["total"] or 0)

    def get_storage_url(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        return request.build_absolute_uri(f"/api/admin-users/{obj.pk}/storage/")
