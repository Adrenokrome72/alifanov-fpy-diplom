# backend/cloud/views.py
import os
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.contrib.auth import login as django_login, logout as django_logout
from .models import Folder, UserFile
from .serializers import FolderSerializer, UserFileSerializer, RegistrationSerializer, LoginSerializer, AdminUserSerializer
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum

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

class UserFileViewSet(viewsets.ModelViewSet):
    """
    ViewSet для UserFile: загрузка (multipart), скачивание, шаринг.
    parser_classes включает JSONParser, чтобы action 'share' принимал JSON.
    """
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
        """
        Обработка загрузки файла (multipart) с проверкой квоты.
        """
        # Получаем файл из request.FILES
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"file": ["No file provided."]}, status=status.HTTP_400_BAD_REQUEST)

        # Проверка квоты
        profile = getattr(request.user, "profile", None)
        if profile:
            size = getattr(uploaded_file, "size", None)
            if size is None:
                # если неизвестен размер, читаем в память (не идеально, но для dev)
                try:
                    uploaded_file.seek(0, os.SEEK_END)
                    size = uploaded_file.tell()
                    uploaded_file.seek(0)
                except Exception:
                    size = None
            if size is not None:
                if profile.remaining_bytes() < size:
                    return Response({"detail": "Quota exceeded. Not enough space."}, status=status.HTTP_400_BAD_REQUEST)

        # Создаём сериализатор и сохраняем с owner
        serializer = self.get_serializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        instance = serializer.save(owner=request.user)
        out_serializer = self.get_serializer(instance, context={"request": request})
        headers = self.get_success_headers(out_serializer.data)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

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

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def external_download(request, token):
    file_obj = get_object_or_404(UserFile, share_token=token, is_shared=True)
    fpath = file_obj.file.path
    if not os.path.exists(fpath):
        raise Http404("Файл не найден")
    file_obj.mark_downloaded()
    return FileResponse(open(fpath, "rb"), as_attachment=True, filename=file_obj.original_name)

class AdminUserViewSet(viewsets.ViewSet):
    """
    Admin API для управления пользователями:
    - list (GET /api/admin-users/)
    - retrieve (GET /api/admin-users/{pk}/)
    - POST /api/admin-users/{pk}/set_quota/  {"quota": 104857600}
    - POST /api/admin-users/{pk}/set_admin/  {"is_staff": true}
    - POST /api/admin-users/{pk}/toggle_active/  {"is_active": false}
    - DELETE /api/admin-users/{pk}/  ?purge=true  (если purge=true — удаляем файлы и записи)
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
        """
        Удаление пользователя. Поддерживает параметр purge=true:
        - purge=true: удалить все файлы пользователя с диска и записи (рекурсивно), затем удалить пользователя.
        - иначе: удалить пользователя (и каскадом удалятся записи).
        """
        user = get_object_or_404(User, pk=pk)
        purge = request.query_params.get("purge", "false").lower() in ("1", "true", "yes")
        if purge:
            # удаляем файлы и записи в транзакции
            with transaction.atomic():
                files_qs = user.files.all()
                # удаление записей вызовет сигнал post_delete -> удаление файлов на диске
                files_qs.delete()
                user.delete()
            return Response({"detail": "user and files deleted"}, status=status.HTTP_200_OK)
        else:
            user.delete()
            return Response({"detail": "user deleted"}, status=status.HTTP_200_OK)