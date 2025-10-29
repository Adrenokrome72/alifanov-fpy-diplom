# users/models.py
from django.conf import settings
from django.db import models
from django.dispatch import receiver
from django.db.models.signals import post_save

# Use settings.AUTH_USER_MODEL (usually 'auth.User' unless you changed it)
USER_MODEL = settings.AUTH_USER_MODEL

class Profile(models.Model):
    """
    Lightweight profile attached to the default User model.
    Contains 'is_blocked' so admins can block accounts without
    replacing the auth user model.
    """
    user = models.OneToOneField(USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    is_blocked = models.BooleanField(default=False)

    def __str__(self):
        return f"Profile(user={self.user.username}, blocked={self.is_blocked})"

# ensure a Profile exists for each user
@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_profile(sender, instance, created, **kwargs):
    if created:
        # create profile automatically for newly created users
        Profile.objects.create(user=instance)
    else:
        # if no profile exists (e.g. older users), create lazily
        if not hasattr(instance, 'profile'):
            Profile.objects.get_or_create(user=instance)
