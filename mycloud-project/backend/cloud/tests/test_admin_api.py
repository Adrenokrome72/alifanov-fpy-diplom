# backend/cloud/tests/test_admin_api.py
from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings

User = get_user_model()

class AdminApiTests(TestCase):
    def setUp(self):
        # создаём админа
        self.admin = User.objects.create_user(username="admin", email="admin@example.com")
        self.admin.set_password("Aa1!admin")
        self.admin.is_staff = True
        self.admin.save()
        # создаём обычного пользователя с файлом
        self.user = User.objects.create_user(username="user1", email="u1@example.com")
        self.user.set_password("Aa1!user")
        self.user.save()
        self.client = APIClient()
        self.client.login(username="admin", password="Aa1!admin")

    def test_list_users_and_stats(self):
        url = "/api/admin-users/"
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        # должен быть минимум 2 пользователя (admin + user)
        data = r.json()
        self.assertTrue(isinstance(data, list))
        # найти user1
        found = None
        for u in data:
            if u.get("username") == "user1":
                found = u
                break
        self.assertIsNotNone(found)
        self.assertIn("files_count", found)
        self.assertIn("files_size", found)

    def test_set_quota(self):
        url = f"/api/admin-users/{self.user.pk}/set_quota/"
        r = self.client.post(url, {"quota": 12345}, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.quota, 12345)

    def test_set_admin_and_toggle_active(self):
        url_admin = f"/api/admin-users/{self.user.pk}/set_admin/"
        r = self.client.post(url_admin, {"is_staff": True}, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_staff)

        url_active = f"/api/admin-users/{self.user.pk}/toggle_active/"
        r2 = self.client.post(url_active, {"is_active": False}, format="json")
        self.assertEqual(r2.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_delete_user_with_purge(self):
        # создаём файл для user
        client_user = APIClient()
        client_user.login(username="user1", password="Aa1!user")
        small_file = SimpleUploadedFile("f.txt", b"abc", content_type="text/plain")
        r = client_user.post("/api/files/", {"file": small_file}, format="multipart")
        self.assertEqual(r.status_code, 201)
        file_id = r.data["id"]

        # admin удаляет пользователя с purge=true
        url_delete = f"/api/admin-users/{self.user.pk}/?purge=true"
        r2 = self.client.delete(url_delete)
        self.assertEqual(r2.status_code, 200)
        # пользователь должен быть удалён
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        # файл записи должен быть удалён (нет записей)
        from cloud.models import UserFile
        self.assertFalse(UserFile.objects.filter(pk=file_id).exists())
