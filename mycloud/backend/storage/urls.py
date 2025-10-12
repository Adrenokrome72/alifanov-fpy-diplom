# backend/storage/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('files/', views.list_files, name='files-list'),
    path('files/upload/', views.upload_file, name='files-upload'),
    path('files/<int:pk>/', views.delete_file, name='files-delete'),  # DELETE
    path('files/<int:pk>/rename/', views.rename_file, name='files-rename'),
    path('files/<int:pk>/comment/', views.comment_file, name='files-comment'),
    path('files/<int:pk>/download/', views.download_file, name='files-download'),
    path('files/<int:pk>/public-link/', views.generate_public_link, name='files-public-link'),
    path('public/<str:token>/download/', views.public_download, name='public-download'),
]
