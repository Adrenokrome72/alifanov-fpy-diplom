from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FolderViewSet, UserFileViewSet, external_download, RegisterView, LoginView, LogoutView, AdminUserViewSet
from .views import csrf_token_view, current_user_view, folder_tree_view, welcome_view

router = DefaultRouter()
router.register(r"folders", FolderViewSet, basename="folders")
router.register(r"files", UserFileViewSet, basename="files")
router.register(r"admin-users", AdminUserViewSet, basename="admin-users")

urlpatterns = [
    path("folders/tree/", folder_tree_view, name="folder-tree"),
    path("welcome/", welcome_view, name="welcome"),
    path("external/download/<str:token>/", external_download, name="external-download"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/csrf/", csrf_token_view, name="api-csrf"),
    path("auth/me/", current_user_view, name="api-current-user"),
    path("admin-users/<int:pk>/storage_tree/", AdminUserViewSet.as_view({'get': 'storage_tree'}), name="admin-storage-tree"),
    path("admin-users/<int:pk>/folder_tree/", AdminUserViewSet.as_view({'get': 'folder_tree'}), name="admin-folder-tree"),
    path("admin-users/<int:pk>/folder_contents/", AdminUserViewSet.as_view({'get': 'folder_contents'}), name="admin-folder-contents"),
    path("", include(router.urls)),
]
