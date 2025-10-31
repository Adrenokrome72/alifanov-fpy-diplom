# backend/config/settings.py
import os
from pathlib import Path
from dotenv import load_dotenv

# базовая загрузка .env (ищем .env в корне репозитория — ../.env относительно backend/config)
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # mycloud-project/backend/.. -> mycloud-project
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)

# Общие настройки
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "fallback-dev-secret-key")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in ("1", "true", "yes")

ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost").split(",")]

# Приложения
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # сторонние
    "rest_framework",
    "corsheaders",

    # наши приложения
    "cloud",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # должен быть выше CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# БД (Postgres из .env)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "mycloud_db"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

# Пароли (по умолчанию)
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Локализация
LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "UTC"
USE_I18N = True
USE_L10N = True
USE_TZ = True

# Статические и медиа файлы
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = os.getenv("MEDIA_URL", "/media/")
MEDIA_ROOT = os.path.abspath(os.getenv("MEDIA_ROOT", os.path.join(BASE_DIR, "media")))

# CORS
CORS_ALLOW_ALL_ORIGINS = True  # в dev удобно, в prod настрой конкретные домены
# либо конкретно:
# CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]

# Django REST Framework - базовые настройки
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
}

# дефолтная квота для новых пользователей (в байтах). Можно переопределить в .env:
# USER_DEFAULT_QUOTA=104857600  # 100 MB
USER_DEFAULT_QUOTA = int(os.getenv("USER_DEFAULT_QUOTA", str(100 * 1024 * 1024)))

# Логи на консоль (минимальная конфигурация)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "[{levelname}] {asctime} {name} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
