# backend/users/urls.py
from django.urls import path, include
from . import views
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register('', views.UserViewSet, basename='users')  # admin-only list

urlpatterns = [
    path('<int:pk>/toggle_block/', views.toggle_block, name='users-toggle-block'),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('csrf/', views.get_csrf, name='get-csrf'),
    path('', views.users_list, name='users-list'),
]
