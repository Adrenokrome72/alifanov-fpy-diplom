from django.urls import path
from .views import (
    FolderCreateView, FolderListView, FolderRenameView, FolderDeleteView, FolderMoveView,
    FileUploadView, FileListView, FileDownloadView, FileShareDownloadView, FileMoveView, FileRenameView, FileDeleteView, FileCommentView
)

urlpatterns = [
    path('folders/create/', FolderCreateView.as_view(), name='folder_create'),
    path('folders/', FolderListView.as_view(), name='folder_list'),
    path('folders/<int:pk>/rename/', FolderRenameView.as_view(), name='folder_rename'),
    path('folders/<int:pk>/delete/', FolderDeleteView.as_view(), name='folder_delete'),
    path('folders/<int:pk>/move/', FolderMoveView.as_view(), name='folder_move'),
    path('files/upload/', FileUploadView.as_view(), name='file_upload'),
    path('files/', FileListView.as_view(), name='file_list'),
    path('files/<int:pk>/download/', FileDownloadView.as_view(), name='file_download'),
    path('share/<uuid:share_link>/', FileShareDownloadView.as_view(), name='file_share_download'),
    path('files/<int:pk>/move/', FileMoveView.as_view(), name='file_move'),
    path('files/<int:pk>/rename/', FileRenameView.as_view(), name='file_rename'),
    path('files/<int:pk>/delete/', FileDeleteView.as_view(), name='file_delete'),
    path('files/<int:pk>/comment/', FileCommentView.as_view(), name='file_comment'),
]