# backend/users/urls.py
from django.urls import path, include
from . import views
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register('', views.UserViewSet, basename='users')  # admin-only list

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('csrf/', views.get_csrf, name='get-csrf'),
    path('', include(router.urls)),
]
