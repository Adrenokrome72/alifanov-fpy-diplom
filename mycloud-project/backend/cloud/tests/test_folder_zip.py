# backend/cloud/tests/test_folder_zip.py
import io
import zipfile
from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from cloud.models import Folder, UserFile

User = get_user_model()

class FolderZipTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="zipuser", email="zip@example.com")
        self.user.set_password("Aa1!pass")
        self.user.save()
        self.client = APIClient()
        self.client.login(username="zipuser", password="Aa1!pass")

    def test_download_zip_of_folder_with_subfolders(self):
        # create root folder A
        r = self.client.post("/api/folders/", {"name": "A"}, format="json")
        self.assertEqual(r.status_code, 201)
        folder_a_id = r.data["id"]

        # create subfolder B inside A
        r2 = self.client.post("/api/folders/", {"name": "B", "parent": folder_a_id}, format="json")
        self.assertEqual(r2.status_code, 201)
        folder_b_id = r2.data["id"]

        # upload file to root folder A
        f1 = SimpleUploadedFile("root.txt", b"root-content", content_type="text/plain")
        r3 = self.client.post("/api/files/", {"file": f1, "folder": folder_a_id}, format="multipart")
        self.assertEqual(r3.status_code, 201)
        id1 = r3.data["id"]

        # upload file to subfolder B
        f2 = SimpleUploadedFile("sub.txt", b"sub-content", content_type="text/plain")
        r4 = self.client.post("/api/files/", {"file": f2, "folder": folder_b_id}, format="multipart")
        self.assertEqual(r4.status_code, 201)
        id2 = r4.data["id"]

        # request zip
        rzip = self.client.get(f"/api/folders/{folder_a_id}/download_zip/")
        self.assertEqual(rzip.status_code, 200)
        # aggregate streaming content
        content = b"".join(rzip.streaming_content)
        # zip files start with 'PK\x03\x04'
        self.assertTrue(content.startswith(b"PK\x03\x04"))
        # validate zip structure
        z = zipfile.ZipFile(io.BytesIO(content))
        names = z.namelist()
        # Expect names like 'A/root.txt' and 'A/B/sub.txt'
        self.assertIn("A/root.txt", names)
        self.assertIn("A/B/sub.txt", names)
        # check file contents
        with z.open("A/root.txt") as fh:
            self.assertEqual(fh.read(), b"root-content")
        with z.open("A/B/sub.txt") as fh:
            self.assertEqual(fh.read(), b"sub-content")
