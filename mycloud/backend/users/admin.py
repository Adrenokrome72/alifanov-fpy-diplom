# users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from .models import Profile

User = get_user_model()

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name = "Profile"
    verbose_name_plural = "Profile"

# unregister/register default admin to add inline
try:
    admin.site.unregister(User)
except Exception:
    pass

@admin.register(User)
class UserAdmin(DefaultUserAdmin):
    inlines = (ProfileInline,)
    list_display = DefaultUserAdmin.list_display + ('get_is_blocked',)
    list_filter = DefaultUserAdmin.list_filter + ('profile__is_blocked',)

    def get_is_blocked(self, obj):
        return getattr(obj.profile, 'is_blocked', False)
    get_is_blocked.boolean = True
    get_is_blocked.short_description = _('Blocked')
