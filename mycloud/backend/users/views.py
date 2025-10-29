# users/views.py
from django.contrib.auth import authenticate, login as django_login, logout as django_logout, get_user_model
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.shortcuts import get_object_or_404

from .serializers import RegisterSerializer, LoginSerializer, AdminUserSerializer

User = get_user_model()

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def csrf(request):
    # hits CSRF middleware and sets cookie
    return Response({"detail": "csrf ok"})

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    user = serializer.save()
    return Response({"id": user.id, "username": user.username}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login(request):
    ser = LoginSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    username = ser.validated_data['username']
    password = ser.validated_data['password']
    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({"detail": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)
    # check blocked via profile (create if missing)
    prof = getattr(user, 'profile', None)
    blocked = False
    if prof is None:
        # lazy create profile if absent
        from .models import Profile
        prof, _ = Profile.objects.get_or_create(user=user)
    blocked = prof.is_blocked
    if blocked:
        return Response({"detail": "User blocked"}, status=status.HTTP_403_FORBIDDEN)
    django_login(request, user)
    return Response({"id": user.id, "username": user.username})

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout(request):
    django_logout(request)
    return Response({"detail": "logged out"})

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by('id')
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]

@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def toggle_block(request, pk):
    user = get_object_or_404(User, pk=pk)
    # make sure profile exists
    prof = getattr(user, 'profile', None)
    if prof is None:
        from .models import Profile
        prof, _ = Profile.objects.get_or_create(user=user)
    prof.is_blocked = not prof.is_blocked
    prof.save(update_fields=['is_blocked'])
    return Response({"id": user.id, "is_blocked": prof.is_blocked})
