# backend/cloud/tests/test_api.py
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()

class ApiTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="apier", password="pass1234")
        self.client = APIClient()
        self.client.login(username="apier", password="pass1234")

    def test_upload_and_download(self):
        url = "/api/files/"  # router name files-list
        small_file = SimpleUploadedFile("a.txt", b"abc", content_type="text/plain")
        response = self.client.post(url, {"file": small_file}, format="multipart")
        # Для отладки можно смотреть response.data
        # print("UPLOAD RESPONSE:", response.status_code, getattr(response, "data", None))
        self.assertEqual(response.status_code, 201)
        file_id = response.data["id"]

        # скачать авторизованно
        download_url = f"/api/files/{file_id}/download/"
        r2 = self.client.get(download_url)
        self.assertEqual(r2.status_code, 200)
        # FileResponse - streaming_content, собираем байты
        content = b"".join(r2.streaming_content)
        self.assertIn(b"abc", content)

    def test_share_token_and_external_download(self):
        url = "/api/files/"
        small_file = SimpleUploadedFile("b.txt", b"bbb", content_type="text/plain")
        r = self.client.post(url, {"file": small_file}, format="multipart")
        self.assertEqual(r.status_code, 201)
        file_id = r.data["id"]

        # генерируем токен (JSON)
        share_url = f"/api/files/{file_id}/share/"
        r2 = self.client.post(share_url, {"action": "generate"}, format="json")
        # print("SHARE RESPONSE:", r2.status_code, getattr(r2, "data", None))
        self.assertEqual(r2.status_code, 200)
        token = r2.data.get("share_token")
        self.assertIsNotNone(token)

        # внешнее скачивание (анонимное)
        ext_url = f"/api/external/download/{token}/"
        client2 = APIClient()  # анонимный клиент
        r3 = client2.get(ext_url)
        self.assertEqual(r3.status_code, 200)
        content = b"".join(r3.streaming_content)
        self.assertIn(b"bbb", content)
