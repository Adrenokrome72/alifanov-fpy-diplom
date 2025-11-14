import os
import tempfile
import zipfile
import secrets
import logging

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.exceptions import PermissionDenied
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
        return Response({"detail": "пользователь создан", "username": user.username}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser, FormParser]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.validated_data["user"]
        django_login(request, user)
        return Response({"detail": "вошёл в систему", "username": user.username}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        django_logout(request)
        return Response({"detail": "вышел из системы"}, status=status.HTTP_200_OK)


class FolderViewSet(viewsets.ModelViewSet):
    queryset = Folder.objects.all()
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        parent_q = self.request.query_params.get("parent")
        qs = Folder.objects.filter(owner=user)  # Только свои папки
        
        if parent_q:
            if parent_q.lower() in ("null", "none", ""):
                qs = qs.filter(parent__isnull=True)
            else:
                qs = qs.filter(parent_id=parent_q)
        
        return qs.order_by("name")

    def perform_create(self, serializer):
        if self.request.user.is_staff:
            data = serializer.validated_data
            if hasattr(self, 'get_owner_from_data'):
                owner_id = self.get_owner_from_data(data)
            else:
                owner_id = self.request.user.id
            if owner_id != self.request.user.id:
                # Проверяем parent для папок
                parent = data.get('parent')
                if parent and parent.owner.id == self.request.user.id:
                    pass
                else:
                    folder = data.get('folder')
                    if folder and folder.owner.id == self.request.user.id:
                        pass
                    else:
                        raise PermissionDenied("Администратор не может выполнить это действие")
        
        serializer.save(owner=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_staff and instance.owner != request.user:
            return Response({"detail": "Только чтение в режиме администратора"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_staff and instance.owner != request.user:
            return Response({"detail": "Только чтение в режиме администратора"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def share(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        if not folder.share_token:
            folder.share_token = secrets.token_urlsafe(16)
            folder.save(update_fields=["share_token"])
        share_url = request.build_absolute_uri(reverse("external-download", args=[folder.share_token]))
        return Response({"share_url": share_url})

    @action(detail=True, methods=["get"])
    def download_zip(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        files_qs = UserFile.objects.filter(folder__in=self._collect_folder_and_children_ids(folder))
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
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        name = request.data.get("name")
        if not name:
            return Response({"detail": "имя обязательно"}, status=status.HTTP_400_BAD_REQUEST)
        folder.name = name
        folder.save(update_fields=["name"])
        return Response(self.get_serializer(folder).data)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
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
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        folder.parent = p
        folder.save(update_fields=["parent"])
        return Response(self.get_serializer(folder).data)

    @action(detail=True, methods=["delete"])
    def purge(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        ids = self._collect_folder_and_children_ids(folder)
        files = UserFile.objects.filter(folder_id__in=ids)
        total_size = files.aggregate(sum=Sum("size"))["sum"] or 0
        files.delete()
        Folder.objects.filter(id__in=ids).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserFileViewSet(viewsets.ModelViewSet):
    queryset = UserFile.objects.all()
    serializer_class = UserFileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        folder_q = self.request.query_params.get("folder")
        qs = UserFile.objects.filter(owner=user)

        if folder_q is not None:
            if folder_q.lower() in ("null", "none", ""):
                qs = qs.filter(folder__isnull=True)
            else:
                qs = qs.filter(folder_id=folder_q)

        return qs

    def perform_create(self, serializer):
        if self.request.user.is_staff:
            data = serializer.validated_data
            if hasattr(self, 'get_owner_from_data'):
                owner_id = self.get_owner_from_data(data)
            else:
                owner_id = self.request.user.id
            if owner_id != self.request.user.id:
                parent = data.get('parent')
                if parent and parent.owner.id == self.request.user.id:
                    pass
                else:
                    folder = data.get('folder')
                    if folder and folder.owner.id == self.request.user.id:
                        pass
                    else:
                        raise PermissionDenied("Админ не может создавать файлы у других пользователей")
        
        serializer.save(owner=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_staff and instance.owner != request.user:
            return Response({"detail": "Только чтение"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_staff and instance.owner != request.user:
            return Response({"detail": "Только чтение"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"file": ["No file provided"]}, status=status.HTTP_400_BAD_REQUEST)

        folder_id = request.data.get("folder") or None
        folder = None
        if folder_id:
            try:
                folder = Folder.objects.get(pk=folder_id)
            except Folder.DoesNotExist:
                return Response({"detail": "Указанная папка не найдена"}, status=status.HTTP_400_BAD_REQUEST)
            if not (request.user.is_staff or folder.owner == request.user):
                return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)

        comment = request.data.get("comment", "")
        original_name = request.data.get("original_name", uploaded_file.name)

        profile = getattr(request.user, "profile", None)
        size = getattr(uploaded_file, "size", None)
        if profile and size is not None:
            used = profile.get_used_bytes()
            if profile.quota is not None and (used + size > profile.quota):
                return Response({"detail": "Квота превышена"}, status=status.HTTP_400_BAD_REQUEST)

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
        # Создаёт или возвращает share token для файла
        obj = self.get_object()
        if not (request.user.is_staff or obj.owner == request.user):
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        if not obj.share_token:
            obj.share_token = secrets.token_urlsafe(16)
            obj.save(update_fields=["share_token"])
        share_url = request.build_absolute_uri(reverse("external-download", args=[obj.share_token]))
        return Response({"share_url": share_url})

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        obj = self.get_object()
        if not (request.user.is_staff or obj.owner == request.user):
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        try:
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
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        new_name = request.data.get("name")
        if not new_name:
            return Response({"detail": "имя обязательно"}, status=status.HTTP_400_BAD_REQUEST)
        if "." in obj.original_name:
            ext = obj.original_name.split(".")[-1]
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
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
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
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        obj.folder = target
        obj.save(update_fields=["folder"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["delete"])
    def purge(self, request, pk=None):
        """Удаление файла"""
        obj = self.get_object()
        if not (request.user.is_staff or obj.owner == request.user):
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        size = obj.size or 0
        owner_profile = getattr(obj.owner, "profile", None)
        obj.file.delete(save=False)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminUserViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAdminUser]

    def list(self, request):
        qs = User.objects.all().order_by("id")
        serializer = AdminUserSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Запрещено"}, status=status.HTTP_403_FORBIDDEN)
        
        # get children folders
        children = Folder.objects.filter(parent=folder).order_by("name")
        # get files
        files = UserFile.objects.filter(folder=folder).order_by("-uploaded_at")
        
        ser_folder = self.get_serializer(folder)
        ser_children = self.get_serializer(children, many=True)
        ser_files = UserFileSerializer(files, many=True, context={"request": request})
        
        return Response({
            "folder": ser_folder.data,
            "children": ser_children.data,
            "files": ser_files.data,
        })

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
            return Response({"detail": "Неверное значение"}, status=status.HTTP_400_BAD_REQUEST)

        profile.quota = quota
        profile.save(update_fields=["quota"])
        return Response({"detail": "Квота изменена", "квота": profile.quota}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def set_admin(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        is_staff = request.data.get("is_staff")
        if is_staff in (True, "true", "True", "1", 1):
            user.is_staff = True
        else:
            user.is_staff = False
        user.save(update_fields=["is_staff"])
        return Response({"detail": "Администратор назначен", "is_staff": user.is_staff}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        
        current_status = user.is_active
        user.is_active = not current_status
        user.save(update_fields=["is_active"])
        
        return Response({
            "detail": "Пользователь обновлен", 
            "is_active": user.is_active
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def storage(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
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
            return Response({"detail": "Пользователь и его файлы удалены"}, status=status.HTTP_200_OK)
        else:
            user.delete()
            return Response({"detail": "Пользователь удален"}, status=status.HTTP_200_OK)
        
    @action(detail=True, methods=["get"])
    def storage_tree(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)

        root_folders = Folder.objects.filter(owner=user, parent__isnull=True).order_by("name")
        root_files = UserFile.objects.filter(owner=user, folder__isnull=True).order_by("-uploaded_at")

        tree_data = {
            "root_folders": FolderSerializer(root_folders, many=True, context={"request": request}).data,
            "root_files": UserFileSerializer(root_files, many=True, context={"request": request}).data,
            "user_info": {
                "id": user.id,
                "username": user.username,
                "full_name": getattr(user.profile, 'full_name', ''),
            }
        }

        return Response(tree_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def folder_tree(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        folders = Folder.objects.filter(owner=user).order_by("name")
        def build_tree(flat_folders):
            nodes = {}
            roots = []
            for folder in flat_folders:
                nodes[folder.id] = {
                    'id': folder.id,
                    'name': folder.name,
                    'parent': folder.parent_id if folder.parent else None,
                    'children': []
                }

            for folder in flat_folders:
                node = nodes[folder.id]
                if node['parent']:
                    if node['parent'] in nodes:
                        nodes[node['parent']]['children'].append(node)
                else:
                    roots.append(node)

            return roots

        tree = build_tree(folders)
        return Response(tree)

    @action(detail=True, methods=["get"])
    def folder_contents(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        folder_id = request.query_params.get("folder_id")

        if not folder_id:
            return Response({"detail": "folder_id parameter required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            folder = Folder.objects.get(id=folder_id, owner=user)
        except Folder.DoesNotExist:
            return Response({"detail": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)

        children = Folder.objects.filter(parent=folder, owner=user).order_by("name")
        files = UserFile.objects.filter(folder=folder, owner=user).order_by("-uploaded_at")

        folder_data = FolderSerializer(folder, context={"request": request}).data
        children_data = FolderSerializer(children, many=True, context={"request": request}).data
        files_data = UserFileSerializer(files, many=True, context={"request": request}).data

        return Response({
            "folder": folder_data,
            "children": children_data,
            "files": files_data
        }, status=status.HTTP_200_OK)


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

    return Response({"detail": "Токен не обнаружен"}, status=status.HTTP_404_NOT_FOUND)


@ensure_csrf_cookie
def csrf_token_view(request):
    # ensure_csrf_cookie гарантирует, что csrftoken cookie будет установлен
    return JsonResponse({"detail": "csrf cookie set"})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def folder_tree_view(request):
    user = request.user
    folders = Folder.objects.filter(owner=user).order_by("name")

    def build_tree(flat_folders):
        nodes = {}
        roots = []

        for folder in flat_folders:
            nodes[folder.id] = {
                'id': folder.id,
                'name': folder.name,
                'parent': folder.parent_id if folder.parent else None,
                'children': []
            }

        for folder in flat_folders:
            node = nodes[folder.id]
            if node['parent']:
                if node['parent'] in nodes:
                    nodes[node['parent']]['children'].append(node)
            else:
                roots.append(node)

        return roots

    tree = build_tree(folders)
    return Response(tree)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def welcome_view(request):

    logger = logging.getLogger(__name__)
    logger.info(f"Request received: {request.method} {request.path}")
    return Response({"message": "Welcome to the Django API Service!"})


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

    used_bytes = None
    if profile and hasattr(profile, "get_used_bytes"):
        try:
            used_bytes = profile.get_used_bytes()
        except Exception:
            used_bytes = None
    else:
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
