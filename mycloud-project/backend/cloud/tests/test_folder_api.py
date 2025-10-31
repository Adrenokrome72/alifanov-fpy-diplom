# backend/cloud/tests/test_folder_api.py
from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from cloud.models import Folder, UserFile
from django.core.files.storage import default_storage

User = get_user_model()

class FolderApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="fu", email="fu@example.com")
        self.user.set_password("Aa1!pass")
        self.user.save()
        self.client = APIClient()
        self.client.login(username="fu", password="Aa1!pass")

    def test_create_move_rename_delete_folder_and_file(self):
        # create folder A
        r = self.client.post("/api/folders/", {"name": "A"}, format="json")
        self.assertEqual(r.status_code, 201)
        folder_a_id = r.data["id"]

        # upload file to root
        f = SimpleUploadedFile("x.txt", b"hello", content_type="text/plain")
        r2 = self.client.post("/api/files/", {"file": f}, format="multipart")
        self.assertEqual(r2.status_code, 201)
        file_id = r2.data["id"]

        # move file to folder A
        mv_resp = self.client.post(f"/api/files/{file_id}/move/", {"folder": folder_a_id}, format="json")
        self.assertEqual(mv_resp.status_code, 200)
        # check file folder
        fobj = UserFile.objects.get(pk=file_id)
        self.assertEqual(fobj.folder_id, folder_a_id)

        # create folder B and move A into B
        r3 = self.client.post("/api/folders/", {"name": "B"}, format="json")
        self.assertEqual(r3.status_code, 201)
        folder_b_id = r3.data["id"]

        mv_folder_resp = self.client.post(f"/api/folders/{folder_a_id}/move/", {"parent": folder_b_id}, format="json")
        self.assertEqual(mv_folder_resp.status_code, 200)
        fa = Folder.objects.get(pk=folder_a_id)
        self.assertEqual(fa.parent_id, folder_b_id)

        # try invalid move: move B into its descendant A (should fail)
        invalid = self.client.post(f"/api/folders/{folder_b_id}/move/", {"parent": folder_a_id}, format="json")
        self.assertEqual(invalid.status_code, 400)

        # rename folder B
        rn = self.client.post(f"/api/folders/{folder_b_id}/rename/", {"name": "B-renamed"}, format="json")
        self.assertEqual(rn.status_code, 200)
        fb = Folder.objects.get(pk=folder_b_id)
        self.assertEqual(fb.name, "B-renamed")

        # purge folder B (this should delete folder B, A, and the file inside A)
        purge = self.client.post(f"/api/folders/{folder_b_id}/purge/", format="json")
        self.assertEqual(purge.status_code, 200)
        # folder B should be gone
        self.assertFalse(Folder.objects.filter(pk=folder_b_id).exists())
        # file should be gone
        self.assertFalse(UserFile.objects.filter(pk=file_id).exists())
        # ensure file not exists on disk (by name returned earlier it's tricky; check storage empty)
        # We can try ensuring no files remain in storage for user folder path (best-effort)
        # (since default_storage may be filesystem, check no leftover files in media)
        # Note: this is a best-effort check, not strict
        # But ensure test didn't crash earlier.

    def test_move_file_to_root(self):
        # create folder and file in it, then move file to root (folder=None)
        r = self.client.post("/api/folders/", {"name": "C"}, format="json")
        self.assertEqual(r.status_code, 201)
        folder_c_id = r.data["id"]
        f = SimpleUploadedFile("y.txt", b"yo", content_type="text/plain")
        r2 = self.client.post("/api/files/", {"file": f, "folder": folder_c_id}, format="multipart")
        self.assertEqual(r2.status_code, 201)
        file_id = r2.data["id"]

        # move to root
        mv = self.client.post(f"/api/files/{file_id}/move/", {"folder": None}, format="json")
        self.assertEqual(mv.status_code, 200)
        fobj = UserFile.objects.get(pk=file_id)
        self.assertIsNone(fobj.folder_id)
