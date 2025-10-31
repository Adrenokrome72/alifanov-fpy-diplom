# backend/cloud/tests/test_models.py
import io
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from ..models import Folder, UserFile

User = get_user_model()

class ModelsTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tester", password="pass1234")
        self.folder = Folder.objects.create(owner=self.user, name="MyFolder")

    def test_file_save_and_delete(self):
        content = b"hello world"
        uploaded = SimpleUploadedFile("hello.txt", content, content_type="text/plain")
        uf = UserFile.objects.create(owner=self.user, folder=self.folder, original_name="hello.txt", file=uploaded)
        self.assertTrue(uf.size > 0)
        path = uf.file.path
        self.assertTrue(uf.file.storage.exists(uf.file.name))
        # удаление записи должно удалить файл
        uf.delete()
        self.assertFalse(uf.file.storage.exists(uf.file.name))
