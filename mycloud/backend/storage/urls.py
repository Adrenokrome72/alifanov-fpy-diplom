from django.urls import path
from .views import (
    FolderCreateView, FolderListView, FolderRenameView, FolderDeleteView, FolderMoveView,
    FileUploadView, FileListView, FileDownloadView, FileShareDownloadView, FileMoveView,
    FileRenameView, FileDeleteView, FileCommentView
)

urlpatterns = [
    path('folders/create/', FolderCreateView.as_view(), name='folder-create'),
    path('folders/', FolderListView.as_view(), name='folder-list'),
    path('folders/<int:pk>/rename/', FolderRenameView.as_view(), name='folder-rename'),
    path('folders/<int:pk>/delete/', FolderDeleteView.as_view(), name='folder-delete'),
    path('folders/<int:pk>/move/', FolderMoveView.as_view(), name='folder-move'),
    path('files/upload/', FileUploadView.as_view(), name='file-upload'),
    path('files/', FileListView.as_view(), name='file-list'),
    path('files/<int:pk>/download/', FileDownloadView.as_view(), name='file-download'),
    path('share/<uuid:share_link>/', FileShareDownloadView.as_view(), name='file-share'),
    path('files/<int:pk>/move/', FileMoveView.as_view(), name='file-move'),
    path('files/<int:pk>/rename/', FileRenameView.as_view(), name='file-rename'),
    path('files/<int:pk>/delete/', FileDeleteView.as_view(), name='file-delete'),
    path('files/<int:pk>/comment/', FileCommentView.as_view(), name='file-comment'),
]