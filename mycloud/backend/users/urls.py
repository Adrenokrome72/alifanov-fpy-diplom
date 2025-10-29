from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
# Read-only admin listing registered at the root of this include,
# but we include router.urls LAST to avoid shadowing explicit paths (csrf/register/login)
router.register('', views.UserViewSet, basename='users')

urlpatterns = [
    # explicit endpoints first (so they are matched before router detail routes)
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('csrf/', views.csrf, name='get-csrf'),
    path('<int:pk>/toggle_block/', views.toggle_block, name='users-toggle-block'),

    # router urls last
    path('', include(router.urls)),
]
