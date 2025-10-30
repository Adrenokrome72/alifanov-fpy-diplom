from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Folder, File
from django.core.files.uploadedfile import SimpleUploadedFile
import os
from django.conf import settings

User = get_user_model()

class StorageTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass')
        self.client.login(username='testuser', password='testpass')
        self.folder = Folder.objects.create(name='testfolder', owner=self.user)

    def test_create_folder(self):
        response = self.client.post('/api/storage/folders/create/', {'name': 'newfolder'})  # Опустили parent, None не нужен
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Folder.objects.filter(name='newfolder').exists())

    def test_upload_file(self):
        file = SimpleUploadedFile("test.txt", b"file_content", "text/plain")
        response = self.client.post('/api/storage/files/upload/', {'file': file, 'folder': self.folder.id}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(File.objects.filter(original_name='test.txt').exists())

    def test_download_file(self):
        file = File.objects.create(original_name='test.txt', unique_name='test.txt', size=12, owner=self.user)
        path = os.path.join(settings.MEDIA_ROOT, str(self.user.id), 'test.txt')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(b"content")
        response = self.client.get(f'/api/storage/files/{file.id}/download/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_share_file(self):
        file = File.objects.create(original_name='test.txt', unique_name='test.txt', size=12, owner=self.user, share_link='12345678-1234-1234-1234-123456789012')
        path = os.path.join(settings.MEDIA_ROOT, str(self.user.id), 'test.txt')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(b"content")  # Добавили создание файла на диске
        response = self.client.get('/api/storage/share/12345678-1234-1234-1234-123456789012/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_storage_limit(self):
        self.user.storage_limit = 10
        self.user.save()
        file = SimpleUploadedFile("large.txt", b"content_over_limit", "text/plain")
        response = self.client.post('/api/storage/files/upload/', {'file': file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)