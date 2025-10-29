# backend/storage/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('folders/', views.list_folders, name='folders-list'),
    path('folders/create/', views.create_folder, name='folders-create'),
    path('folders/<int:pk>/rename/', views.rename_folder, name='folders-rename'),
    path('folders/<int:pk>/', views.delete_folder, name='folders-delete'),

    path('files/', views.list_files, name='files-list'),
    path('files/upload/', views.upload_file, name='files-upload'),
    path('files/<int:pk>/', views.delete_file, name='files-delete'),
    path('files/<int:pk>/rename/', views.rename_file, name='files-rename'),
    path('files/<int:pk>/move/', views.move_file, name='files-move'),
    path('files/<int:pk>/download/', views.download_file, name='files-download'),
    path('files/<int:pk>/public-link/', views.public_link, name='files-public-link'),

    path('public/<str:token>/download/', views.public_download, name='public-download'),
]
