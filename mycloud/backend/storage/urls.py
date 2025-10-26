# backend/storage/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('folders/', views.list_folders),
    path('folders/create/', views.create_folder),
    path('folders/<int:pk>/rename/', views.rename_folder),
    path('folders/<int:pk>/', views.delete_folder),

    path('files/', views.list_files),
    path('files/upload/', views.upload_file),
    path('files/<int:pk>/', views.file_detail),
    path('files/<int:pk>/rename/', views.rename_file),
    path('files/<int:pk>/move/', views.move_file),
    path('files/<int:pk>/delete/', views.delete_file),
    path('files/<int:pk>/public-link/', views.generate_public_link),
    path('public/<str:token>/download/', views.public_download),
]
