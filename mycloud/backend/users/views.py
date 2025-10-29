from django.conf import settings
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout, get_user_model
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import ensure_csrf_cookie

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, AllowAny, IsAuthenticated
from rest_framework.response import Response

from rest_framework.serializers import ModelSerializer, CharField, ValidationError

User = get_user_model()


# --- Serializers ----------------------------------------------------------------
class UserSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff')


class RegisterSerializer(ModelSerializer):
    password = CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name')

    def validate_username(self, value):
        import re
        # accept letters/numbers/._- and length 4..20, must start with letter
        if not re.match(r'^[A-Za-z][A-Za-z0-9._-]{3,19}$', value):
            raise ValidationError('Username must start with a letter, contain only letters/numbers/._- and be 4..20 chars long')
        return value

    def create(self, validated_data):
        pwd = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(pwd)
        user.save()
        return user


# --- CSRF endpoint (plain Django view) -----------------------------------------
# IMPORTANT: plain Django view (not DRF @api_view) and decorated with ensure_csrf_cookie.
# This avoids DRF global permission classes and guarantees the csrftoken cookie is set.
@ensure_csrf_cookie
def csrf(request):
    token = get_token(request)
    return JsonResponse({'detail': 'ok', 'csrftoken': token})


# --- Auth endpoints ------------------------------------------------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    data = request.data
    serializer = RegisterSerializer(data=data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    user = serializer.save()
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    data = request.data if isinstance(request.data, dict) else {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return Response({'detail': 'username and password required'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({'detail': 'invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

    auth_login(request, user)

    # ensure session saved and key present
    try:
        request.session.save()
    except Exception:
        pass
    session_key = request.session.session_key

    # ensure CSRF token exists
    token = get_token(request)

    response = Response({'ok': True, 'username': user.username, 'id': user.id})
    # set sessionid cookie explicitly (so non-browser HTTP clients can pick it up)
    if session_key:
        response.set_cookie(
            settings.SESSION_COOKIE_NAME,
            session_key,
            httponly=True,
            samesite=getattr(settings, 'SESSION_COOKIE_SAMESITE', 'Lax'),
            secure=getattr(settings, 'SESSION_COOKIE_SECURE', False),
            path=getattr(settings, 'SESSION_COOKIE_PATH', '/'),
        )
    # csrf cookie
    response.set_cookie(
        settings.CSRF_COOKIE_NAME,
        token,
        httponly=False,
        samesite=getattr(settings, 'CSRF_COOKIE_SAMESITE', 'Lax'),
        secure=getattr(settings, 'CSRF_COOKIE_SECURE', False),
        path=getattr(settings, 'CSRF_COOKIE_PATH', '/'),
    )
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    auth_logout(request)
    return Response({'ok': True})


# --- Admin toggle_block --------------------------------------------------------
@api_view(['POST'])
@permission_classes([IsAdminUser])
def toggle_block(request, pk):
    user = get_object_or_404(User, pk=pk)
    if not hasattr(user, 'is_blocked'):
        return Response({'detail': 'User model missing is_blocked field'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    user.is_blocked = not bool(user.is_blocked)
    user.save(update_fields=['is_blocked'])
    return Response({'id': user.id, 'is_blocked': user.is_blocked})


# --- ViewSet for admin listing -------------------------------------------------
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminUser]
    queryset = User.objects.all().order_by('-id')
    serializer_class = UserSerializer
