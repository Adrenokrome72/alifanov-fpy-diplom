import os
import tempfile
import zipfile
import secrets

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth import login as django_login, logout as django_logout, get_user_model
from django.db import transaction
from django.db.models import Sum
from django.views.decorators.csrf import ensure_csrf_cookie
from django.conf import settings
from django.utils import timezone
from django.urls import reverse

from .models import Folder, UserFile, UserProfile
from .serializers import (
    FolderSerializer,
    UserFileSerializer,
    RegistrationSerializer,
    LoginSerializer,
    AdminUserSerializer,
)

User = get_user_model()


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        return getattr(obj, "owner", None) == request.user


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser, FormParser]

    def post(self, request, *args, **kwargs):
        serializer = RegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        return Response({"detail": "user created", "username": user.username}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser, FormParser]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.validated_data["user"]
        django_login(request, user)
        return Response({"detail": "logged in", "username": user.username}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        django_logout(request)
        return Response({"detail": "logged out"}, status=status.HTTP_200_OK)


class FolderViewSet(viewsets.ModelViewSet):
    queryset = Folder.objects.all()
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        owner_q = self.request.query_params.get("owner")
        if owner_q and user.is_staff:
            return Folder.objects.filter(owner_id=owner_q)
        if user.is_staff:
            return Folder.objects.all()
        return Folder.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def share(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if not folder.share_token:
            folder.share_token = secrets.token_urlsafe(16)
            folder.save(update_fields=["share_token"])
        share_url = request.build_absolute_uri(reverse("external-download", args=[folder.share_token]))
        return Response({"share_url": share_url})

    @action(detail=True, methods=["get"])
    def download_zip(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        # collect all files inside folder (recursive)
        files_qs = UserFile.objects.filter(folder__in=self._collect_folder_and_children_ids(folder))
        # create temp zip
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        try:
            with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
                for f in files_qs:
                    try:
                        path = f.file.path
                        arcname = f.original_name
                        zf.write(path, arcname=arcname)
                    except Exception:
                        continue
            tmp.flush()
            tmp.close()
            resp = FileResponse(open(tmp.name, "rb"), as_attachment=True, filename=f"{folder.name}.zip")
            return resp
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass

    def _collect_folder_and_children_ids(self, folder):
        # BFS or DFS to collect child folder ids
        ids = [folder.id]
        stack = [folder]
        while stack:
            cur = stack.pop()
            children = Folder.objects.filter(parent=cur)
            for c in children:
                ids.append(c.id)
                stack.append(c)
        return ids

    @action(detail=True, methods=["post"])
    def rename(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        name = request.data.get("name")
        if not name:
            return Response({"detail": "name required"}, status=status.HTTP_400_BAD_REQUEST)
        folder.name = name
        folder.save(update_fields=["name"])
        return Response(self.get_serializer(folder).data)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        parent_id = request.data.get("parent")
        if parent_id in (None, "", "null"):
            folder.parent = None
            folder.save(update_fields=["parent"])
            return Response(self.get_serializer(folder).data)
        try:
            p = Folder.objects.get(pk=parent_id)
        except Folder.DoesNotExist:
            return Response({"detail": "Target parent not found"}, status=status.HTTP_400_BAD_REQUEST)
        if not (request.user.is_staff or p.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        folder.parent = p
        folder.save(update_fields=["parent"])
        return Response(self.get_serializer(folder).data)

    @action(detail=True, methods=["delete"])
    def purge(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        # delete files and subfolders recursively
        ids = self._collect_folder_and_children_ids(folder)
        files = UserFile.objects.filter(folder_id__in=ids)
        total_size = files.aggregate(sum=Sum("size"))["sum"] or 0
        files.delete()
        Folder.objects.filter(id__in=ids).delete()
        # Не пытаемся присваивать profile.used_bytes — используем вычисление при запросе
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserFileViewSet(viewsets.ModelViewSet):
    queryset = UserFile.objects.all()
    serializer_class = UserFileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        # admin may pass owner param to view other user's files
        owner_q = self.request.query_params.get("owner")
        if owner_q and user.is_staff:
            return UserFile.objects.filter(owner_id=owner_q)
        if user.is_staff:
            return UserFile.objects.all()
        return UserFile.objects.filter(owner=user)

    def perform_create(self, serializer):
        # ensure owner is request.user
        serializer.save(owner=self.request.user)

    def create(self, request, *args, **kwargs):
        # robust creation for multipart
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"file": ["No file provided"]}, status=status.HTTP_400_BAD_REQUEST)

        folder_id = request.data.get("folder") or None
        folder = None
        if folder_id:
            try:
                folder = Folder.objects.get(pk=folder_id)
            except Folder.DoesNotExist:
                return Response({"detail": "Target folder not found"}, status=status.HTTP_400_BAD_REQUEST)
            if not (request.user.is_staff or folder.owner == request.user):
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        comment = request.data.get("comment", "")
        original_name = request.data.get("original_name", uploaded_file.name)

        # quota check
        profile = getattr(request.user, "profile", None)
        size = getattr(uploaded_file, "size", None)
        if profile and size is not None:
            used = profile.get_used_bytes()
            if profile.quota is not None and (used + size > profile.quota):
                return Response({"detail": "Quota exceeded"}, status=status.HTTP_400_BAD_REQUEST)

        # Create object and save file
        userfile = UserFile(
            owner=request.user,
            folder=folder,
            original_name=original_name,
            comment=comment,
            size=getattr(uploaded_file, "size", 0),
        )
        userfile.file.save(uploaded_file.name, uploaded_file, save=False)
        userfile.save()

        serializer = self.get_serializer(userfile, context={"request": request})
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"])
    def share(self, request, pk=None):
        """Создаёт или возвращает share token для файла"""
        obj = self.get_object()
        if not (request.user.is_staff or obj.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if not obj.share_token:
            obj.share_token = secrets.token_urlsafe(16)
            obj.save(update_fields=["share_token"])
        share_url = request.build_absolute_uri(reverse("external-download", args=[obj.share_token]))
        return Response({"share_url": share_url})

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        obj = self.get_object()
        if not (request.user.is_staff or obj.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        try:
            # increment download_count and update last_downloaded_at
            try:
                obj.download_count = (obj.download_count or 0) + 1
                obj.last_downloaded_at = timezone.now()
                obj.save(update_fields=["download_count", "last_downloaded_at"])
            except Exception:
                pass
            return FileResponse(obj.file.open("rb"), as_attachment=True, filename=obj.original_name)
        except Exception:
            raise Http404

    @action(detail=True, methods=["post"])
    def rename(self, request, pk=None):
        obj = self.get_object()
        if not (request.user.is_staff or obj.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        new_name = request.data.get("name")
        if not new_name:
            return Response({"detail": "name required"}, status=status.HTTP_400_BAD_REQUEST)
        # ensure extension preserved: extract ext from original_name
        if "." in obj.original_name:
            ext = obj.original_name.split(".")[-1]
            # if user provided extension, strip it
            if "." in new_name:
                new_name = new_name.rsplit(".", 1)[0]
            obj.original_name = f"{new_name}.{ext}"
        else:
            # no extension present
            if "." in new_name:
                new_name = new_name.rsplit(".", 1)[0]
            obj.original_name = new_name
        obj.save(update_fields=["original_name"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        obj = self.get_object()
        if not (request.user.is_staff or obj.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        folder_id = request.data.get("folder")
        if folder_id in (None, "", "null"):
            obj.folder = None
            obj.save(update_fields=["folder"])
            return Response(self.get_serializer(obj).data)
        try:
            target = Folder.objects.get(pk=folder_id)
        except Folder.DoesNotExist:
            return Response({"detail": "Target folder not found"}, status=status.HTTP_400_BAD_REQUEST)
        if not (request.user.is_staff or target.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        obj.folder = target
        obj.save(update_fields=["folder"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["delete"])
    def purge(self, request, pk=None):
        """Удаление файла"""
        obj = self.get_object()
        if not (request.user.is_staff or obj.owner == request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        size = obj.size or 0
        owner_profile = getattr(obj.owner, "profile", None)
        obj.file.delete(save=False)
        obj.delete()
        # не трогаем used_bytes как поле — профиль будет отражать актуальное значение через агрегацию
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminUserViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAdminUser]

    def list(self, request):
        qs = User.objects.all().order_by("id")
        serializer = AdminUserSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        serializer = AdminUserSerializer(user, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def set_quota(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)

        profile = getattr(user, "profile", None)
        if profile is None:
            profile = UserProfile.objects.create(user=user, quota=getattr(settings, "USER_DEFAULT_QUOTA", 0))

        q = request.data.get("quota")
        try:
            quota = int(q)
            if quota < 0:
                raise ValueError()
        except Exception:
            return Response({"detail": "Invalid quota (expect integer bytes)"}, status=status.HTTP_400_BAD_REQUEST)

        profile.quota = quota
        profile.save(update_fields=["quota"])
        return Response({"detail": "quota updated", "quota": profile.quota}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def set_admin(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        is_staff = request.data.get("is_staff")
        if is_staff in (True, "true", "True", "1", 1):
            user.is_staff = True
        else:
            user.is_staff = False
        user.save(update_fields=["is_staff"])
        return Response({"detail": "is_staff set", "is_staff": user.is_staff}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        val = request.data.get("is_active")
        if val in (True, "true", "True", "1", 1):
            user.is_active = True
        else:
            user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"detail": "is_active set", "is_active": user.is_active}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def storage(self, request, pk=None):
        """
        Returns top-level folders and top-level files for the given user,
        as well as used_bytes and quota. Admin can use this to navigate to user's storage.
        """
        user = get_object_or_404(User, pk=pk)
        # top-level folders (parent IS NULL)
        folders = Folder.objects.filter(owner=user, parent__isnull=True).order_by("name")
        files = UserFile.objects.filter(owner=user, folder__isnull=True).order_by("-uploaded_at")

        folder_ser = FolderSerializer(folders, many=True, context={"request": request})
        file_ser = UserFileSerializer(files, many=True, context={"request": request})

        profile = getattr(user, "profile", None)
        used_bytes = 0
        try:
            used_bytes = int(user.files.aggregate(total=Sum("size"))["total"] or 0)
        except Exception:
            used_bytes = 0
        if profile:
            quota = profile.quota
        else:
            quota = getattr(settings, "USER_DEFAULT_QUOTA", 10 * 1024 * 1024 * 1024)

        return Response({
            "folders": folder_ser.data,
            "files": file_ser.data,
            "used_bytes": used_bytes,
            "quota": quota,
        }, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        purge = request.query_params.get("purge", "false").lower() in ("1", "true", "yes")
        if purge:
            with transaction.atomic():
                files_qs = user.files.all()
                files_qs.delete()
                user.delete()
            return Response({"detail": "user and files deleted"}, status=status.HTTP_200_OK)
        else:
            user.delete()
            return Response({"detail": "user deleted"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def external_download(request, token):
    """
    Публичный эндпоинт: ищем сначала файл по token, затем папку.
    Если найден файл — отдаём его (FileResponse) и увеличиваем счётчик.
    Если найдена папка — создаём zip и отдаём.
    """
    try:
        f = UserFile.objects.filter(share_token=token).first()
        if f:
            try:
                f.download_count = (f.download_count or 0) + 1
                f.last_downloaded_at = timezone.now()
                f.save(update_fields=["download_count", "last_downloaded_at"])
            except Exception:
                pass
            try:
                return FileResponse(f.file.open("rb"), as_attachment=True, filename=f.original_name)
            except Exception:
                raise Http404

        folder = Folder.objects.filter(share_token=token).first()
        if folder:
            # collect files recursively
            def collect_ids(folder):
                ids = [folder.id]
                stack = [folder]
                while stack:
                    cur = stack.pop()
                    children = Folder.objects.filter(parent=cur)
                    for c in children:
                        ids.append(c.id)
                        stack.append(c)
                return ids
            ids = collect_ids(folder)
            files_qs = UserFile.objects.filter(folder_id__in=ids)
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
            try:
                with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
                    for ff in files_qs:
                        try:
                            zf.write(ff.file.path, arcname=ff.original_name)
                        except Exception:
                            continue
                tmp.flush()
                tmp.close()
                return FileResponse(open(tmp.name, "rb"), as_attachment=True, filename=f"{folder.name}.zip")
            finally:
                try:
                    os.unlink(tmp.name)
                except Exception:
                    pass

    except Exception:
        pass

    return Response({"detail": "Token not found"}, status=status.HTTP_404_NOT_FOUND)


@ensure_csrf_cookie
def csrf_token_view(request):
    # ensure_csrf_cookie гарантирует, что csrftoken cookie будет установлен
    return JsonResponse({"detail": "csrf cookie set"})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def current_user_view(request):
    """
    Возвращает информацию о текущем пользователе:
      - id, username, email, full_name, is_staff, is_active
      - профиль: quota (в байтах), used_bytes
    """
    user = request.user
    profile = getattr(user, "profile", None)

    # Compute used_bytes in a robust way by calling model helper if exists
    used_bytes = None
    if profile and hasattr(profile, "get_used_bytes"):
        try:
            used_bytes = profile.get_used_bytes()
        except Exception:
            used_bytes = None
    else:
        # fallback to aggregate on user's files
        try:
            used_bytes = int(user.files.aggregate(total=Sum("size"))["total"] or 0)
        except Exception:
            used_bytes = None

    full_name = ""
    if profile and getattr(profile, "full_name", ""):
        full_name = profile.full_name
    else:
        full_name = getattr(user, "full_name", "") or getattr(user, "first_name", "") or ""

    data = {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "full_name": full_name,
        "is_staff": bool(user.is_staff),
        "is_active": bool(user.is_active),
        "profile": {
            "quota": getattr(profile, "quota", None),
            "used_bytes": used_bytes,
        },
    }
    return Response(data)
