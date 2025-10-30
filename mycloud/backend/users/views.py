from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout, get_user_model
from .models import CustomUser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django.http import HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from logging import getLogger
from .serializers import UserSerializer

logger = getLogger(__name__)
User = get_user_model()

@ensure_csrf_cookie
def csrf_view(request):
    logger.info("CSRF cookie requested")
    return HttpResponse("CSRF cookie set")

class RegisterView(APIView):
    permission_classes = []  # Allow unauthenticated access
    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            login(request, user)  # Set session after registration
            return Response({'detail': 'Registered'}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = []  # Allow unauthenticated access
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)  # Set session
            return Response({'detail': 'Logged in'}, status=status.HTTP_200_OK)
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

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