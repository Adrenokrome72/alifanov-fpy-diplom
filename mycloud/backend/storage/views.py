# backend/storage/views.py
import logging, os
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from .models import Folder, StoredFile
from .serializers import FolderSerializer, StoredFileSerializer

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_folders(request):
    if request.user.is_staff:
        qs = Folder.objects.all()
    else:
        qs = Folder.objects.filter(owner=request.user)
    serializer = FolderSerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_folder(request):
    name = request.data.get('name')
    parent_raw = request.data.get('parent', None)
    if not name:
        return Response({'detail': 'name required'}, status=status.HTTP_400_BAD_REQUEST)
    parent = None
    if parent_raw is not None and str(parent_raw).lower() not in ('null', 'none', ''):
        try:
            parent_id = int(parent_raw)
            parent = get_object_or_404(Folder, pk=parent_id)
            # Ensure ownership: non-admin can't create under someone else's folder
            if not request.user.is_staff and parent.owner != request.user:
                return Response({'detail': 'No access to parent'}, status=status.HTTP_403_FORBIDDEN)
        except ValueError:
            return Response({'detail': 'parent must be integer or null'}, status=status.HTTP_400_BAD_REQUEST)

    folder = Folder.objects.create(name=name, parent=parent, owner=request.user)
    serializer = FolderSerializer(folder, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def rename_folder(request, pk):
    folder = get_object_or_404(Folder, pk=pk)
    if not (request.user.is_staff or folder.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    new_name = request.data.get('name')
    if not new_name:
        return Response({'detail': 'name required'}, status=status.HTTP_400_BAD_REQUEST)
    folder.name = new_name
    folder.save(update_fields=['name'])
    return Response(FolderSerializer(folder, context={'request': request}).data)

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_folder(request, pk):
    folder = get_object_or_404(Folder, pk=pk)
    if not (request.user.is_staff or folder.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    folder.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_files(request):
    folder_id = request.query_params.get('folder_id', None)
    if folder_id and str(folder_id).lower() not in ('null', 'none', ''):
        try:
            fid = int(folder_id)
            files = StoredFile.objects.filter(folder__id=fid)
        except ValueError:
            return Response({'detail': 'folder_id must be integer'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        if request.user.is_staff and 'user_id' in request.query_params:
            try:
                uid = int(request.query_params.get('user_id'))
                files = StoredFile.objects.filter(owner__id=uid)
            except Exception:
                return Response({'detail': 'user_id invalid'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            files = StoredFile.objects.filter(owner=request.user)
    serializer = StoredFileSerializer(files, many=True, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_file(request):
    f = request.FILES.get('file')
    if not f:
        return Response({'detail':'file required'}, status=status.HTTP_400_BAD_REQUEST)
    comment = request.data.get('comment', '') or ''
    folder_raw = request.data.get('folder', None)
    folder_obj = None
    if folder_raw and str(folder_raw).lower() not in ('null', 'none', ''):
        try:
            folder_id = int(folder_raw)
            folder_obj = get_object_or_404(Folder, pk=folder_id)
            if not request.user.is_staff and folder_obj.owner != request.user:
                return Response({'detail':'No access to folder'}, status=status.HTTP_403_FORBIDDEN)
        except ValueError:
            return Response({'detail':'folder must be integer id or null'}, status=status.HTTP_400_BAD_REQUEST)

    sf = StoredFile.objects.create(
        owner=request.user,
        original_name=f.name,
        stored_file=f,
        comment=comment,
        folder=folder_obj
    )
    # size set in model.save()
    serializer = StoredFileSerializer(sf, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def move_file(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    target_raw = request.data.get('target_folder', None)
    if target_raw is None or str(target_raw).lower() in ('null', 'none', ''):
        obj.folder = None
        obj.save(update_fields=['folder'])
    else:
        try:
            tid = int(target_raw)
            folder = get_object_or_404(Folder, pk=tid)
            if not request.user.is_staff and folder.owner != request.user:
                return Response({'detail':'No access to target folder'}, status=status.HTTP_403_FORBIDDEN)
            obj.folder = folder
            obj.save(update_fields=['folder'])
        except ValueError:
            return Response({'detail':'target_folder must be integer id or null'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(StoredFileSerializer(obj, context={'request': request}).data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def rename_file(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    new_name = request.data.get('new_name')
    if not new_name:
        return Response({'detail':'new_name required'}, status=status.HTTP_400_BAD_REQUEST)
    obj.original_name = new_name
    obj.save(update_fields=['original_name'])
    return Response(StoredFileSerializer(obj, context={'request': request}).data)

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_file(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    path = obj.stored_file.path if obj.stored_file else None
    obj.delete()
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        logger.exception("delete file disk remove failed")
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_public_link(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    token = obj.generate_public_link()
    url = request.build_absolute_uri(f"/api/storage/public/{token}/download/")
    return Response({'public_link': url})

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_download(request, token):
    obj = get_object_or_404(StoredFile, public_link_token=token)
    fp = obj.stored_file.path if obj.stored_file else None
    if not fp or not os.path.exists(fp):
        raise Http404
    resp = FileResponse(open(fp, 'rb'))
    resp['Content-Disposition'] = f'attachment; filename="{obj.original_name}"'
    obj.increment_download()
    return resp

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def file_detail(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    return Response(StoredFileSerializer(obj, context={'request': request}).data)
