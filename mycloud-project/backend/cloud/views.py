# backend/cloud/views.py
import os
import tempfile
import zipfile
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from django.http import FileResponse, Http404, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth import login as django_login, logout as django_logout
from django.contrib.auth import get_user_model
from django.db import transaction

from .models import Folder, UserFile
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
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Folder.objects.all()
        return Folder.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    # helper: collect subtree folders (ids)
    def _collect_subtree(self, folder):
        ids = []
        queue = [folder]
        while queue:
            node = queue.pop(0)
            ids.append(node.pk)
            children = list(node.children.all())
            queue.extend(children)
        return ids

    def _is_descendant(self, candidate, root):
        """
        Проверить, является ли candidate потомком root.
        """
        node = candidate
        while node:
            if node.pk == root.pk:
                return True
            node = node.parent
        return False

    @action(detail=True, methods=["post"])
    def rename(self, request, pk=None):
        folder = get_object_or_404(Folder, pk=pk)
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Нет прав доступа"}, status=status.HTTP_403_FORBIDDEN)
        new_name = request.data.get("name")
        if not new_name:
            return Response({"detail": "Missing name"}, status=status.HTTP_400_BAD_REQUEST)
        if Folder.objects.filter(owner=folder.owner, parent=folder.parent, name=new_name).exclude(pk=folder.pk).exists():
            return Response({"detail": "Folder with this name already exists in target parent"}, status=status.HTTP_400_BAD_REQUEST)
        folder.name = new_name
        folder.save(update_fields=["name"])
        return Response({"detail": "renamed", "name": folder.name}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        folder = get_object_or_404(Folder, pk=pk)
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Нет прав доступа"}, status=status.HTTP_403_FORBIDDEN)

        parent_id = request.data.get("parent", None)
        if parent_id in ("", None):
            folder.parent = None
            folder.save(update_fields=["parent"])
            return Response({"detail": "moved", "parent": None}, status=status.HTTP_200_OK)

        try:
            parent = Folder.objects.get(pk=int(parent_id))
        except Exception:
            return Response({"detail": "Parent folder not found"}, status=status.HTTP_400_BAD_REQUEST)

        if not (request.user.is_staff or parent.owner == folder.owner):
            return Response({"detail": "Parent folder belongs to different owner"}, status=status.HTTP_403_FORBIDDEN)

        if parent.pk == folder.pk:
            return Response({"detail": "Cannot move folder into itself"}, status=status.HTTP_400_BAD_REQUEST)

        # защита от перемещения внутрь потомка
        if self._is_descendant(parent, folder):
            return Response({"detail": "Cannot move folder into its descendant"}, status=status.HTTP_400_BAD_REQUEST)

        if Folder.objects.filter(owner=folder.owner, parent=parent, name=folder.name).exclude(pk=folder.pk).exists():
            return Response({"detail": "Folder with same name exists in target parent"}, status=status.HTTP_400_BAD_REQUEST)

        folder.parent = parent
        folder.save(update_fields=["parent"])
        return Response({"detail": "moved", "parent": parent.pk}, status=status.HTTP_200_OK)

    def _delete_subtree_files(self, folder):
        folder_ids = self._collect_subtree(folder)
        files_qs = UserFile.objects.filter(folder_id__in=folder_ids)
        for f in list(files_qs):
            f.delete()

    @action(detail=True, methods=["post"])
    def purge(self, request, pk=None):
        folder = get_object_or_404(Folder, pk=pk)
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Нет прав доступа"}, status=status.HTTP_403_FORBIDDEN)
        folder_ids = self._collect_subtree(folder)
        with transaction.atomic():
            for fid in folder_ids:
                files = UserFile.objects.filter(folder_id=fid)
                for f in list(files):
                    f.delete()
            Folder.objects.filter(pk__in=folder_ids).delete()
        return Response({"detail": "folder and contents deleted"}, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        folder = self.get_object()
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Нет прав доступа"}, status=status.HTTP_403_FORBIDDEN)
        folder_ids = self._collect_subtree(folder)
        with transaction.atomic():
            for fid in folder_ids:
                files = UserFile.objects.filter(folder_id=fid)
                for f in list(files):
                    f.delete()
            Folder.objects.filter(pk__in=folder_ids).delete()
        return Response({"detail": "deleted"}, status=status.HTTP_200_OK)

    def _compute_relative_arcname(self, file_obj, root_folder):
        """
        Вычисляет относительный путь внутри zip для файла file_obj относительно root_folder.
        Формат: <root_folder.name>/<subpath...>/<original_name>
        """
        parts = []
        node = file_obj.folder
        # Сборим части пути до root_folder (исключая root_folder)
        while node and node.pk != root_folder.pk:
            parts.append(node.name)
            node = node.parent
        parts.reverse()
        if parts:
            rel_path = "/".join(parts)
            arc = f"{root_folder.name}/{rel_path}/{file_obj.original_name}"
        else:
            arc = f"{root_folder.name}/{file_obj.original_name}"
        return arc

    @action(detail=True, methods=["get"], url_path="download_zip")
    def download_zip(self, request, pk=None):
        """
        Создаёт временный zip из всех файлов в папке (рекурсивно) и отдает его в streaming-ответе.
        Файлы внутри zip будут иметь структуру:
            <folder_name>/<subfolder...>/<original_filename>
        После завершения передачи временный файл удаляется.
        """
        folder = get_object_or_404(Folder, pk=pk)
        if not (request.user.is_staff or folder.owner == request.user):
            return Response({"detail": "Нет прав доступа"}, status=status.HTTP_403_FORBIDDEN)

        # собираем все файлы в subtree
        subtree_ids = self._collect_subtree(folder)
        files_qs = UserFile.objects.filter(folder_id__in=subtree_ids)  # включает файлы в самой папке и подпапках

        # создаём временный zip файл на диске
        tmp = tempfile.NamedTemporaryFile(prefix="folderzip_", suffix=".zip", delete=False)
        tmp_name = tmp.name
        tmp.close()  # закроем дескриптор, чтобы ziplib мог открыть путь

        try:
            with zipfile.ZipFile(tmp_name, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                for f in files_qs:
                    fpath = f.file.path
                    if not os.path.exists(fpath):
                        continue
                    arcname = self._compute_relative_arcname(f, folder)
                    # note: arcname должен быть unix-подобным в zip
                    zf.write(fpath, arcname=arcname)

            # StreamingHttpResponse с удалением файла после отправки
            def file_iterator(path, chunk_size=8192):
                try:
                    with open(path, "rb") as fh:
                        while True:
                            chunk = fh.read(chunk_size)
                            if not chunk:
                                break
                            yield chunk
                finally:
                    try:
                        os.remove(path)
                    except Exception:
                        pass

            resp = StreamingHttpResponse(file_iterator(tmp_name), content_type="application/zip")
            resp["Content-Disposition"] = f'attachment; filename="{folder.name}.zip"'
            return resp
        except Exception as exc:
            # попытка удалить tmp файл при ошибке
            try:
                os.remove(tmp_name)
            except Exception:
                pass
            return Response({"detail": "Error creating zip", "error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserFileViewSet(viewsets.ModelViewSet):
    queryset = UserFile.objects.all()
    serializer_class = UserFileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff and self.request.query_params.get("owner"):
            owner_id = self.request.query_params.get("owner")
            return UserFile.objects.filter(owner_id=owner_id)
        if user.is_staff:
            return UserFile.objects.all()
        return UserFile.objects.filter(owner=user)

    def create(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"file": ["No file provided."]}, status=status.HTTP_400_BAD_REQUEST)

        profile = getattr(request.user, "profile", None)
        if profile:
            size = getattr(uploaded_file, "size", None)
            if size is None:
                try:
                    uploaded_file.seek(0, os.SEEK_END)
                    size = uploaded_file.tell()
                    uploaded_file.seek(0)
                except Exception:
                    size = None
            if size is not None:
                if profile.remaining_bytes() < size:
                    return Response({"detail": "Quota exceeded. Not enough space."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        instance = serializer.save(owner=request.user)
        out_serializer = self.get_serializer(instance, context={"request": request})
        headers = self.get_success_headers(out_serializer.data)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        file_obj = get_object_or_404(UserFile, pk=pk)
        if not (request.user.is_staff or file_obj.owner == request.user):
            return Response({"detail": "Нет прав доступа"}, status=status.HTTP_403_FORBIDDEN)

        folder_id = request.data.get("folder", None)
        if folder_id in ("", None):
            file_obj.folder = None
            file_obj.save(update_fields=["folder"])
            return Response({"detail": "moved", "folder": None}, status=status.HTTP_200_OK)

        try:
            folder = Folder.objects.get(pk=int(folder_id))
        except Exception:
            return Response({"detail": "Target folder not found"}, status=status.HTTP_400_BAD_REQUEST)

        if not (request.user.is_staff or folder.owner == file_obj.owner):
            return Response({"detail": "Target folder belongs to different owner"}, status=status.HTTP_403_FORBIDDEN)

        file_obj.folder = folder
        file_obj.save(update_fields=["folder"])
        return Response({"detail": "moved", "folder": folder.pk}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        file_obj = get_object_or_404(UserFile, pk=pk)
        if not (request.user.is_staff or file_obj.owner == request.user):
            return Response({"detail": "Нет прав доступа"}, status=status.HTTP_403_FORBIDDEN)
        fpath = file_obj.file.path
        if not os.path.exists(fpath):
            raise Http404("Файл не найден на сервере.")
        file_obj.mark_downloaded()
        return FileResponse(open(fpath, "rb"), as_attachment=True, filename=file_obj.original_name)

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, pk=None):
        file_obj = get_object_or_404(UserFile, pk=pk)
        if not (request.user.is_staff or file_obj.owner == request.user):
            return Response({"detail": "Нет прав доступа"}, status=status.HTTP_403_FORBIDDEN)
        action_param = request.data.get("action", "generate")
        if action_param == "generate":
            token = file_obj.generate_share_token()
            return Response({
                "share_token": token,
                "share_url": request.build_absolute_uri(f"/api/external/download/{token}/")
            }, status=status.HTTP_200_OK)
        elif action_param == "revoke":
            file_obj.revoke_share()
            return Response({"detail": "share revoked"}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "unknown action"}, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)


class AdminUserViewSet(viewsets.ViewSet):
    """
    Admin API для управления пользователями.
    """
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
            return Response({"detail": "User profile not found"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            quota = int(request.data.get("quota"))
            if quota < 0:
                raise ValueError()
        except Exception:
            return Response({"detail": "Invalid quota"}, status=status.HTTP_400_BAD_REQUEST)
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
@permission_classes([permissions.AllowAny])
def external_download(request, token):
    file_obj = get_object_or_404(UserFile, share_token=token, is_shared=True)
    fpath = file_obj.file.path
    if not os.path.exists(fpath):
        raise Http404("Файл не найден")
    file_obj.mark_downloaded()
    return FileResponse(open(fpath, "rb"), as_attachment=True, filename=file_obj.original_name)
