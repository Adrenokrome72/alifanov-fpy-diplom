# backend/cloud/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FolderViewSet, UserFileViewSet, external_download, RegisterView, LoginView, LogoutView, AdminUserViewSet

router = DefaultRouter()
router.register(r"folders", FolderViewSet, basename="folders")
router.register(r"files", UserFileViewSet, basename="files")
router.register(r"admin-users", AdminUserViewSet, basename="admin-users")

urlpatterns = [
    path("", include(router.urls)),
    path("external/download/<str:token>/", external_download, name="external-download"),

    # auth endpoints
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
]
