from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

class UserTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username='admin', email='admin@example.com', password='adminpass')
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass')
        self.client.login(username='admin', password='adminpass')

    def test_register_user(self):
        response = self.client.post('/api/users/register/', {
            'username': 'newuser',
            'email': 'new@example.com',
            'password': 'NewPass1!'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_login_user(self):
        response = self.client.post('/api/users/login/', {
            'username': 'testuser',
            'password': 'testpass'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_block_user(self):
        response = self.client.post(f'/api/users/{self.user.id}/manage/', {'action': 'block'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_blocked)

    def test_set_storage_limit(self):
        response = self.client.post(f'/api/users/{self.user.id}/manage/', {'action': 'set_limit', 'limit': 200000000})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.storage_limit, 200000000)

    def test_delete_user(self):
        response = self.client.post(f'/api/users/{self.user.id}/manage/', {'action': 'delete'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.filter(id=self.user.id).exists())