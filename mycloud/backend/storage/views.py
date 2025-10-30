from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Folder, File
from django.contrib.auth import get_user_model
from django.http import FileResponse
from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .serializers import FolderSerializer
from logging import getLogger
import os
import uuid
from django.utils import timezone

logger = getLogger(__name__)

User = get_user_model()

class FolderCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        print('Folder create request:', request.data)
        serializer = FolderSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=201)
        print('Serializer errors:', serializer.errors)
        return Response(serializer.errors, status=400)

class FolderListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        folders = Folder.objects.filter(owner=request.user)
        return Response([{'id': f.id, 'name': f.name, 'parent': f.parent_id if f.parent else None, 'child_count': f.child_count} for f in folders])

class FolderRenameView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        folder = get_object_or_404(Folder, pk=pk, owner=request.user)
        folder.name = request.data.get('name', folder.name)
        folder.save()
        logger.info(f"Folder renamed: {folder.name} by {request.user}")
        return Response({'detail': 'Renamed'})

class FolderDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        folder = get_object_or_404(Folder, pk=pk, owner=request.user)
        # Рекурсивное удаление (Django CASCADE сделает, но обновим parent)
        if folder.parent:
            folder.parent.update_child_count()
        folder.delete()
        logger.info(f"Folder deleted: {pk} by {request.user}")
        return Response({'detail': 'Deleted'})

class FolderMoveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        folder = get_object_or_404(Folder, pk=pk, owner=request.user)
        target_id = request.data.get('target_folder')
        target = Folder.objects.get(pk=target_id) if target_id else None
        if folder.parent:
            folder.parent.update_child_count()
        folder.parent = target
        folder.save()
        if target:
            target.update_child_count()
        logger.info(f"Folder moved: {folder.name} by {request.user}")
        return Response({'detail': 'Moved'})

class FileUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.can_upload:
            logger.warning(f"No upload permission for {request.user}")
            return Response({'detail': 'No upload permission'}, status=status.HTTP_403_FORBIDDEN)
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file'}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.used_storage + file.size > request.user.storage_limit:
            logger.warning(f"Storage limit exceeded for {request.user}")
            return Response({'detail': 'Storage limit exceeded'}, status=status.HTTP_400_BAD_REQUEST)
        folder_id = request.data.get('folder')
        folder = Folder.objects.get(pk=folder_id) if folder_id else None
        f = File.objects.create(
            original_name=file.name,
            size=file.size,
            comment=request.data.get('comment', ''),
            owner=request.user,
            folder=folder
        )
        path = os.path.join(settings.MEDIA_ROOT, str(request.user.id), f.unique_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb+') as dest:
            for chunk in file.chunks():
                dest.write(chunk)
        # Thumbnail if image
        if f.original_name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
            f.thumbnail = path  # ImageKit обработает
            f.save()
        if folder:
            folder.update_child_count()
        logger.info(f"File uploaded: {f.original_name} by {request.user}")
        return Response({'id': f.id, 'name': f.original_name, 'download_url': f'{settings.MEDIA_URL}{f.unique_name}'}, status=status.HTTP_201_CREATED)

class FileListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.can_view:
            return Response({'detail': 'No view permission'}, status=status.HTTP_403_FORBIDDEN)
        folder_id = request.query_params.get('folder_id')
        order_by = request.query_params.get('order_by', 'uploaded_at')  # name, size, -uploaded_at для desc
        files = File.objects.filter(owner=request.user, folder_id=folder_id).order_by(order_by)
        return Response([{
            'id': f.id, 'name': f.original_name, 'size': f.size, 'comment': f.comment,
            'uploaded_at': f.uploaded_at, 'last_downloaded_at': f.last_downloaded_at,
            'share_link': str(f.share_link), 'has_share': True, 'thumbnail': f.thumbnail.url if f.thumbnail else None
        } for f in files])

class FileDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not request.user.can_download:
            return Response({'detail': 'No download permission'}, status=status.HTTP_403_FORBIDDEN)
        f = get_object_or_404(File, pk=pk, owner=request.user)
        f.last_downloaded_at = timezone.now()
        f.save()
        path = os.path.join(settings.MEDIA_ROOT, str(request.user.id), f.unique_name)
        if not os.path.exists(path):
            logger.error(f"File not found on disk: {path}")
            return Response({'detail': 'File not found'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(open(path, 'rb'), as_attachment=True, filename=f.original_name)

class FileShareDownloadView(APIView):
    # Без permission_classes - доступно всем
    def get(self, request, share_link):
        f = get_object_or_404(File, share_link=share_link)
        if not f.owner.can_download:
            logger.warning("Share access denied due to owner permissions")
            return Response({'detail': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        path = os.path.join(settings.MEDIA_ROOT, str(f.owner.id), f.unique_name)
        if not os.path.exists(path):
            logger.error(f"Share file not found: {path}")
            return Response({'detail': 'File not found'}, status=status.HTTP_404_NOT_FOUND)
        logger.info(f"File shared download: {f.original_name}")
        return FileResponse(open(path, 'rb'), as_attachment=True, filename=f.original_name)

class FileMoveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        f = get_object_or_404(File, pk=pk, owner=request.user)
        target_id = request.data.get('target_folder')
        target = Folder.objects.get(pk=target_id) if target_id else None
        if f.folder:
            f.folder.update_child_count()
        f.folder = target
        f.save()
        if target:
            target.update_child_count()
        logger.info(f"File moved: {f.original_name} by {request.user}")
        return Response({'detail': 'Moved'})

class FileRenameView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        f = get_object_or_404(File, pk=pk, owner=request.user)
        f.original_name = request.data.get('name', f.original_name)
        f.save()
        logger.info(f"File renamed: {f.original_name} by {request.user}")
        return Response({'detail': 'Renamed'})

class FileDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        f = get_object_or_404(File, pk=pk, owner=request.user)
        f.delete()
        logger.info(f"File deleted: {pk} by {request.user}")
        return Response({'detail': 'Deleted'})

class FileCommentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        f = get_object_or_404(File, pk=pk, owner=request.user)
        f.comment = request.data.get('comment', f.comment)
        f.save()
        logger.info(f"File comment updated: {f.original_name} by {request.user}")
        return Response({'detail': 'Updated'})