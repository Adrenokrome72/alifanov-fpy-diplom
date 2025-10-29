# backend/storage/views.py
import os
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.conf import settings

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import StoredFile, Folder
from .serializers import StoredFileSerializer, FolderSerializer


class IsOwnerOrAdmin(permissions.BasePermission):
    """Object-level permission: owner or staff only."""
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_staff:
            return True
        return getattr(obj, 'owner', None) == request.user


# ---------- Folders ----------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_folders(request):
    """GET /api/storage/folders/"""
    if request.user.is_staff and 'user_id' in request.query_params:
        uid = request.query_params.get('user_id')
        folders = Folder.objects.filter(owner__id=uid)
    else:
        folders = Folder.objects.filter(owner=request.user)
    serializer = FolderSerializer(folders, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_folder(request):
    """POST /api/storage/folders/create/  {name, parent}"""
    name = request.data.get('name')
    parent_id = request.data.get('parent', None)
    if not name:
        return Response({"detail": "name required"}, status=status.HTTP_400_BAD_REQUEST)

    parent = None
    if parent_id not in (None, '', 'null'):
        try:
            parent = get_object_or_404(Folder, pk=int(parent_id))
        except ValueError:
            return Response({"detail": "invalid parent id"}, status=status.HTTP_400_BAD_REQUEST)
        # ownership check
        if not (request.user.is_staff or parent.owner == request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

    folder = Folder.objects.create(name=name, owner=request.user, parent=parent)
    return Response(FolderSerializer(folder).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def rename_folder(request, pk):
    """POST /api/storage/folders/<pk>/rename/  {name}"""
    folder = get_object_or_404(Folder, pk=pk)
    if not (request.user.is_staff or folder.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    name = request.data.get('name')
    if not name:
        return Response({"detail": "name required"}, status=status.HTTP_400_BAD_REQUEST)
    folder.name = name
    folder.save(update_fields=['name'])
    return Response(FolderSerializer(folder).data)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_folder(request, pk):
    """DELETE /api/storage/folders/<pk>/"""
    folder = get_object_or_404(Folder, pk=pk)
    if not (request.user.is_staff or folder.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    folder.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------- Files ----------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_files(request):
    """
    GET /api/storage/files/?folder_id=...  (or without folder -> all user's files)
    Admins can pass user_id to view other user's files.
    """
    user = request.user
    if user.is_staff and 'user_id' in request.query_params:
        uid = request.query_params.get('user_id')
        files = StoredFile.objects.filter(owner__id=uid)
    else:
        folder_id = request.query_params.get('folder_id', None)
        if folder_id in (None, '', 'null'):
            files = StoredFile.objects.filter(owner=user)
        else:
            try:
                files = StoredFile.objects.filter(owner=user, folder__id=int(folder_id))
            except ValueError:
                return Response({"detail": "invalid folder_id"}, status=status.HTTP_400_BAD_REQUEST)

    serializer = StoredFileSerializer(files, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_file(request):
    """
    POST /api/storage/files/upload/
    multipart: 'file' (required), 'comment' (optional), 'folder' (optional; id or 'null')
    """
    f = request.FILES.get('file')
    if not f:
        return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

    comment = request.data.get('comment', '')
    folder_id = request.data.get('folder', None)

    if folder_id in ('null', 'None', '', None):
        folder = None
    else:
        try:
            folder = get_object_or_404(Folder, pk=int(folder_id))
            if not (request.user.is_staff or folder.owner == request.user):
                return Response(status=status.HTTP_403_FORBIDDEN)
        except ValueError:
            return Response({"detail": "invalid folder id"}, status=status.HTTP_400_BAD_REQUEST)

    sf = StoredFile(
        owner=request.user,
        original_name=f.name,
        stored_file=f,
        comment=comment,
        folder=folder
    )
    sf.save()
    serializer = StoredFileSerializer(sf, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_file(request, pk):
    """DELETE /api/storage/files/<pk>/"""
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    path = obj.stored_file.path if obj.stored_file else None
    obj.delete()
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def rename_file(request, pk):
    """POST /api/storage/files/<pk>/rename/ {new_name}"""
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    new_name = request.data.get('new_name')
    if not new_name:
        return Response({"detail": "new_name required"}, status=status.HTTP_400_BAD_REQUEST)
    obj.original_name = new_name
    obj.save(update_fields=['original_name'])
    return Response(StoredFileSerializer(obj, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def comment_file(request, pk):
    """POST /api/storage/files/<pk>/comment/ {comment}"""
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    comment = request.data.get('comment', '')
    obj.comment = comment
    obj.save(update_fields=['comment'])
    return Response(StoredFileSerializer(obj, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_file(request, pk):
    """GET /api/storage/files/<pk>/download/"""
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    fp = obj.stored_file.path if obj.stored_file else None
    if not fp or not os.path.exists(fp):
        raise Http404
    response = FileResponse(open(fp, 'rb'))
    response['Content-Disposition'] = f'attachment; filename="{obj.original_name}"'
    obj.increment_download()
    return response


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def public_link(request, pk):
    """
    POST /api/storage/files/<pk>/public-link/
    Generates public token and returns full URL in 'public_link' (and token).
    (This is provided under the expected name `public_link` to match urls.)
    """
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    token = obj.generate_public_link()
    url = request.build_absolute_uri(f"/api/storage/public/{token}/download/")
    return Response({"public_link": url, "token": token})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_download(request, token):
    """
    GET /api/storage/public/<token>/download/
    Download via public token (no auth required).
    """
    obj = get_object_or_404(StoredFile, public_link_token=token)
    fp = obj.stored_file.path if obj.stored_file else None
    if not fp or not os.path.exists(fp):
        raise Http404
    response = FileResponse(open(fp, 'rb'))
    response['Content-Disposition'] = f'attachment; filename="{obj.original_name}"'
    obj.increment_download()
    return response


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def move_file(request, pk):
    """
    POST /api/storage/files/<pk>/move/
    payload: { target_folder: <id or null> }
    """
    file_obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or file_obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)

    target = request.data.get('target_folder', None)
    if target in (None, '', 'null'):
        file_obj.folder = None
        file_obj.save(update_fields=['folder'])
        return Response(StoredFileSerializer(file_obj, context={'request': request}).data)

    try:
        target_folder = get_object_or_404(Folder, pk=int(target))
    except ValueError:
        return Response({"detail": "invalid target_folder id"}, status=status.HTTP_400_BAD_REQUEST)

    if not (request.user.is_staff or target_folder.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)

    file_obj.folder = target_folder
    file_obj.save(update_fields=['folder'])
    return Response(StoredFileSerializer(file_obj, context={'request': request}).data)
