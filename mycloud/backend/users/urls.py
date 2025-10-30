from django.urls import path
from .views import RegisterView, LoginView, LogoutView, UserListView, UserManageView, csrf_view

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('', UserListView.as_view(), name='user_list'),
    path('<int:pk>/manage/', UserManageView.as_view(), name='user_manage'),
    path('csrf/', csrf_view, name='csrf'),
]