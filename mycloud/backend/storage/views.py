# backend/storage/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, parser_classes
from .serializers import StoredFileSerializer
from .models import StoredFile
from django.shortcuts import get_object_or_404
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import FileResponse, Http404
import os
from django.conf import settings

class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        return obj.owner == request.user

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_files(request):
    user = request.user
    if user.is_staff and 'user_id' in request.query_params:
        uid = request.query_params.get('user_id')
        files = StoredFile.objects.filter(owner__id=uid)
    else:
        files = StoredFile.objects.filter(owner=user)
    serializer = StoredFileSerializer(files, many=True, context={'request':request})
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_file(request):
    # Expecting 'file' and optional 'comment'
    f = request.FILES.get('file')
    if not f:
        return Response({"detail":"file is required"}, status=status.HTTP_400_BAD_REQUEST)
    comment = request.data.get('comment', '')
    sf = StoredFile(
        owner=request.user,
        original_name=f.name,
        stored_file=f,
        comment=comment,
    )
    sf.save()
    return Response(StoredFileSerializer(sf, context={'request':request}).data, status=status.HTTP_201_CREATED)

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_file(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    path = obj.stored_file.path
    obj.delete()
    # try remove file from disk
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def rename_file(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    new_name = request.data.get('new_name')
    if not new_name:
        return Response({"detail":"new_name required"}, status=status.HTTP_400_BAD_REQUEST)
    obj.original_name = new_name
    obj.save(update_fields=['original_name'])
    return Response(StoredFileSerializer(obj, context={'request':request}).data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def comment_file(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    comment = request.data.get('comment', '')
    obj.comment = comment
    obj.save(update_fields=['comment'])
    return Response(StoredFileSerializer(obj, context={'request':request}).data)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_file(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    fp = obj.stored_file.path
    if not os.path.exists(fp):
        raise Http404
    response = FileResponse(open(fp,'rb'))
    response['Content-Disposition'] = f'attachment; filename="{obj.original_name}"'
    obj.increment_download()
    return response

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_public_link(request, pk):
    obj = get_object_or_404(StoredFile, pk=pk)
    if not (request.user.is_staff or obj.owner == request.user):
        return Response(status=status.HTTP_403_FORBIDDEN)
    token = obj.generate_public_link()
    url = request.build_absolute_uri(f"/api/storage/public/{token}/download/")
    return Response({"public_link": url})

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_download(request, token):
    obj = get_object_or_404(StoredFile, public_link_token=token)
    fp = obj.stored_file.path
    if not os.path.exists(fp):
        raise Http404
    response = FileResponse(open(fp,'rb'))
    response['Content-Disposition'] = f'attachment; filename="{obj.original_name}"'
    obj.increment_download()
    return response
