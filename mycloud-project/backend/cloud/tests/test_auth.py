# backend/cloud/tests/test_auth.py
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.conf import settings

User = get_user_model()

class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_registration_validation_and_success(self):
        url = "/api/auth/register/"
        # invalid username
        r = self.client.post(url, {"username": "1bad", "email": "a@b.com", "password": "Aa1!aa"}, format="json")
        self.assertEqual(r.status_code, 400)

        # invalid password
        r = self.client.post(url, {"username": "gooduser", "email": "a@b.com", "password": "weak"}, format="json")
        self.assertEqual(r.status_code, 400)

        # valid registration
        r = self.client.post(url, {"username": "gooduser", "email": "good@example.com", "password": "Aa1!aa", "full_name": "Good User"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(User.objects.filter(username="gooduser").exists())
        user = User.objects.get(username="gooduser")
        self.assertIsNotNone(getattr(user, "profile", None))
        # default quota
        self.assertEqual(user.profile.quota, settings.USER_DEFAULT_QUOTA)

    def test_login_logout(self):
        # create user
        user = User.objects.create_user(username="loginuser", email="l@example.com")
        user.set_password("Aa1!pass")
        user.save()

        login_url = "/api/auth/login/"
        r = self.client.post(login_url, {"username": "loginuser", "password": "Aa1!pass"}, format="json")
        self.assertEqual(r.status_code, 200)
        # now logout
        logout_url = "/api/auth/logout/"
        r2 = self.client.post(logout_url, format="json")
        # logout requires authenticated user, so we must login first using same client that holds session:
        # above login used same client, so logout should work
        self.assertEqual(r2.status_code, 200)

    def test_quota_enforcement_on_upload(self):
        # create user with tiny quota
        user = User.objects.create_user(username="quser", email="q@example.com")
        user.set_password("Aa1!pass")
        user.save()
        # ensure profile exists
        profile = user.profile
        profile.quota = 1  # 1 byte
        profile.save(update_fields=["quota"])

        client = APIClient()
        client.login(username="quser", password="Aa1!pass")

        # try upload small file (size > 1), should be rejected with 400
        from django.core.files.uploadedfile import SimpleUploadedFile
        small_file = SimpleUploadedFile("big.txt", b"hello", content_type="text/plain")
        r = client.post("/api/files/", {"file": small_file}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Quota", str(r.data) or "")
