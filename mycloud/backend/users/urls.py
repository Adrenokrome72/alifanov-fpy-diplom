# users/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('', views.UserViewSet, basename='users')

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('csrf/', views.csrf, name='get-csrf'),
    path('<int:pk>/toggle_block/', views.toggle_block, name='users-toggle-block'),
    path('', include(router.urls)),
]
