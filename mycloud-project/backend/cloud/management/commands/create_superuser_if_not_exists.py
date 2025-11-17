import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction


class Command(BaseCommand):
    help = 'Create superuser if it does not exist'

    def handle(self, *args, **options):
        User = get_user_model()

        username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin')
        email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
        password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'admin123')

        if not User.objects.filter(username=username).exists():
            with transaction.atomic():
                User.objects.create_superuser(
                    username=username,
                    email=email,
                    password=password
                )
            self.stdout.write(
                self.style.SUCCESS(f'Superuser "{username}" created successfully')
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'Superuser "{username}" already exists')
            )
