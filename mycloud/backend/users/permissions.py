# backend/users/permissions.py
from rest_framework import permissions

class NotBlockedPermission(permissions.BasePermission):
    message = "User is blocked."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return True
        profile = getattr(request.user, "storage_profile", None)
        if profile and profile.is_blocked:
            return False
        return True
