# Backend (Django REST API)

## Описание
Это бэкенд-часть облачного хранилища файлов, построенный на Django REST Framework. Предоставляет API для аутентификации, управления файлами и папками, а также административных функций.

## Структура папок и файлов
- `config/` - Настройки Django проекта
  - `settings.py` - Основные настройки
  - `urls.py` - Маршруты проекта
  - `wsgi.py` - WSGI конфигурация
- `cloud/` - Основное приложение
  - `models.py` - Модели данных (User, File, Folder)
  - `views.py` - Представления API
  - `serializers.py` - Сериализаторы для API
  - `urls.py` - URL маршруты приложения
- `management/commands/` - Django management команды
  - `wait_for_db.py` - Ожидание готовности БД
  - `create_superuser_if_not_exists.py` - Создание суперпользователя
- `manage.py` - Скрипт управления Django
- `requirements.txt` - Python зависимости

### Переменные окружения (.env)
- `DJANGO_SECRET_KEY` - Секретный ключ Django
- `DJANGO_DEBUG` - Режим отладки (True/False)
- `DJANGO_ALLOWED_HOSTS` - Разрешённые хосты (через запятую)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` - Настройки PostgreSQL
- `CORS_ALLOWED_ORIGINS` - Разрешённые CORS origins
- `CSRF_TRUSTED_ORIGINS` - Доверенные CSRF origins
- `USER_DEFAULT_QUOTA` - Квота пользователя по умолчанию
