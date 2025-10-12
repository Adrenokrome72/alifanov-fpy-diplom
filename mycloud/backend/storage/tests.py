from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
import io

User = get_user_model()

class StorageAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='t1', password='Aa1!aaa', email='t1@example.com')
        self.client.login(username='t1', password='Aa1!aaa')

    def test_upload_and_list(self):
        f = io.BytesIO(b"hello world")
        f.name = 'hello.txt'
        resp = self.client.post('/api/storage/files/upload/', {'file': f, 'comment': 'x'}, format='multipart')
        assert resp.status_code == 201
        resp2 = self.client.get('/api/storage/files/')
        assert resp2.status_code == 200
        assert len(resp2.json()) == 1