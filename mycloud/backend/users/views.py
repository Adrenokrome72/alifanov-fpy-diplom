# backend/users/views.py
from rest_framework import generics, status, permissions, viewsets
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAdminUser
from django.contrib.auth import login, logout
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.views.decorators.csrf import ensure_csrf_cookie
from .serializers import RegisterSerializer, LoginSerializer

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAdminUser]

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    login(request, user)
    return Response({"detail":"Logged in"}, status=status.HTTP_200_OK)

@api_view(['POST'])
def logout_view(request):
    logout(request)
    return Response({"detail":"Logged out"}, status=status.HTTP_200_OK)

@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_csrf(request):
    """Возвращает csrf cookie (только для dev)"""
    return JsonResponse({'detail': 'CSRF cookie set'})
