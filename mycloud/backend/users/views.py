# backend/users/views.py
from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .serializers import UserListSerializer

User = get_user_model()

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Позволяет доступ только админам для модификаций; read-only для других аутентифицированных (если нужно).
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ReadOnly модель: list/retrieve доступна только админам (настройка через permission_classes ниже),
    а также добавлена custom action toggle_block (POST).
    """
    queryset = User.objects.all().order_by('username')
    serializer_class = UserListSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, permissions.IsAdminUser])
    def toggle_block(self, request, pk=None):
        """
        Toggle block status for the user.
        Uses User.is_active inverted view: is_blocked = not is_active.
        """
        try:
            user = self.get_object()
        except Exception:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # prevent admin from toggling himself (optional)
        if user.pk == request.user.pk:
            return Response({'detail': "Can't toggle yourself"}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = not bool(user.is_active)
        user.save(update_fields=['is_active'])
        return Response({'id': user.pk, 'is_blocked': not user.is_active})
