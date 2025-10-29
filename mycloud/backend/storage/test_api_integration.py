# backend/storage/tests_api_integration.py
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile

from storage.models import Folder, StoredFile

User = get_user_model()


class UsersAndStorageAPITest(TestCase):
    """
    Integration tests covering:
     - register / login / csrf
     - admin toggle_block
     - create folder, upload file, list, public link, move
    """

    def setUp(self):
        self.client = APIClient()
        # admin and regular user
        self.admin = User.objects.create_user('adminuser', email='admin@example.com', password='adminpass', is_staff=True)
        self.user = User.objects.create_user('alice', email='alice@example.com', password='alicepass')

    def test_register_login_logout_and_csrf(self):
        # Register a fresh user via API (username rules in your project may apply; choose valid username)
        reg_data = {
            "username": "bob1",
            "password": "bobpass123",
            "email": "bob1@example.com"
        }
        resp = self.client.post("/api/users/register/", reg_data, format='json')
        self.assertIn(resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), msg=f"register failed: {resp.status_code} {resp.data}")

        # Login (session-backed)
        resp = self.client.post("/api/users/login/", {"username": reg_data["username"], "password": reg_data["password"]}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, msg=f"login failed: {resp.status_code} {resp.data}")

        # Check CSRF endpoint
        resp = self.client.get("/api/users/csrf/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # logout
        resp = self.client.post("/api/users/logout/")
        self.assertIn(resp.status_code, (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT))

    def test_admin_toggle_block(self):
        # admin toggles block on a normal user
        self.client.force_authenticate(user=self.admin)
        # ensure target user exists
        target = self.user
        resp = self.client.post(f"/api/users/{target.id}/toggle_block/")
        self.assertIn(resp.status_code, (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT))

        # call again — toggle back
        resp2 = self.client.post(f"/api/users/{target.id}/toggle_block/")
        self.assertIn(resp2.status_code, (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT))

    def test_folder_create_upload_and_list_and_public_link_and_move(self):
        # authenticate as normal user
        self.client.force_authenticate(user=self.user)

        # create folder
        resp = self.client.post("/api/storage/folders/create/", {"name": "myfolder", "parent": None}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, msg=f"create folder failed: {resp.status_code} {resp.data}")
        folder_id = resp.data.get('id')
        self.assertIsNotNone(folder_id)

        # list folders
        resp = self.client.get("/api/storage/folders/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        found = any(f.get('id') == folder_id for f in resp.data)
        self.assertTrue(found, msg="created folder not present in list")

        # upload a small file to folder (multipart)
        file_content = b"hello world"
        f = SimpleUploadedFile("hello.txt", file_content, content_type="text/plain")
        resp = self.client.post("/api/storage/files/upload/", {'file': f, 'comment': 'x', 'folder': folder_id}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, msg=f"upload failed: {resp.status_code} {resp.data}")
        file_id = resp.data.get('id')
        self.assertIsNotNone(file_id)

        # list files in folder
        resp = self.client.get(f"/api/storage/files/?folder_id={folder_id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(any(x.get('id') == file_id for x in resp.data), msg="uploaded file not in folder listing")

        # generate public link
        resp = self.client.post(f"/api/storage/files/{file_id}/public-link/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('public_link', resp.data)

        # create second folder and move file there
        resp2 = self.client.post("/api/storage/folders/create/", {"name": "folder2", "parent": None}, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)
        folder2_id = resp2.data.get('id')
        # move file to folder2
        resp3 = self.client.post(f"/api/storage/files/{file_id}/move/", {"target_folder": folder2_id}, format='json')
        self.assertIn(resp3.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        # verify file now has folder id folder2 (if serializer returns folder)
        # fetch file detail via list filter
        resp4 = self.client.get(f"/api/storage/files/?folder_id={folder2_id}")
        self.assertTrue(any(x.get('id') == file_id for x in resp4.data), msg="file not moved to folder2")
