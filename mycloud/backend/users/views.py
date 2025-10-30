from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from .models import CustomUser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django.http import HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from logging import getLogger

logger = getLogger(__name__)

@ensure_csrf_cookie
def csrf_view(request):
    logger.info("CSRF cookie requested")
    return HttpResponse("CSRF cookie set")

class RegisterView(APIView):
    def post(self, request):
        data = request.data
        # Валидация по заданию
        username = data.get('username')
        if not username or not username[0].isalpha() or len(username) < 4 or len(username) > 20 or not username.isalnum():
            return Response({'detail': 'Invalid username'}, status=status.HTTP_400_BAD_REQUEST)
        email = data.get('email')
        if not email or '@' not in email:
            return Response({'detail': 'Invalid email'}, status=status.HTTP_400_BAD_REQUEST)
        password = data.get('password')
        if not password or len(password) < 6 or not any(c.isupper() for c in password) or not any(c.isdigit() for c in password) or not any(not c.isalnum() for c in password):
            return Response({'detail': 'Invalid password'}, status=status.HTTP_400_BAD_REQUEST)
        if CustomUser.objects.filter(username=username).exists():
            return Response({'detail': 'Username exists'}, status=status.HTTP_400_BAD_REQUEST)
        user = CustomUser.objects.create_user(username=username, email=email, password=password)
        logger.info(f"User registered: {user.username}")
        return Response({'detail': 'Registered'}, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    def post(self, request):
        user = authenticate(username=request.data['username'], password=request.data['password'])
        if user:
            if user.is_blocked:
                logger.warning(f"Blocked user tried login: {user.username}")
                return Response({'detail': 'Blocked'}, status=status.HTTP_403_FORBIDDEN)
            login(request, user)
            logger.info(f"User logged in: {user.username}")
            return Response({'detail': 'Logged in'})
        logger.warning("Invalid login attempt")
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    def post(self, request):
        logout(request)
        logger.info("User logged out")
        return Response({'detail': 'Logged out'})

class UserListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = CustomUser.objects.all().values('id', 'username', 'email', 'is_staff', 'is_blocked', 'storage_limit', 'used_storage', 'can_upload', 'can_download', 'can_view')
        return Response(list(users))

class UserManageView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            user = CustomUser.objects.get(pk=pk)
            action = request.data.get('action')
            if action == 'block':
                user.is_blocked = True
            elif action == 'unblock':
                user.is_blocked = False
            elif action == 'delete':
                user.delete()
                logger.info(f"User deleted: {pk}")
                return Response({'detail': 'Deleted'})
            elif action == 'set_admin':
                user.is_staff = True
            elif action == 'remove_admin':
                user.is_staff = False
            elif action == 'set_limit':
                user.storage_limit = request.data.get('limit', user.storage_limit)
            elif action == 'toggle_upload':
                user.can_upload = not user.can_upload
            elif action == 'toggle_download':
                user.can_download = not user.can_download
            elif action == 'toggle_view':
                user.can_view = not user.can_view
            user.save()
            logger.info(f"Admin action on {user.username}: {action}")
            return Response({'detail': 'Updated'})
        except CustomUser.DoesNotExist:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)