FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive

ARG HTTP_PROXY
ARG HTTPS_PROXY
ENV http_proxy=${HTTP_PROXY}
ENV https_proxy=${HTTPS_PROXY}

WORKDIR /app

RUN set -eux; \
    printf '%s\n' \
      'deb http://mirror.yandex.ru/debian/ trixie main contrib non-free' \
      'deb http://mirror.yandex.ru/debian/ trixie-updates main contrib non-free' \
      'deb http://mirror.yandex.ru/debian-security/ trixie-security main contrib non-free' \
    > /etc/apt/sources.list; \
    rm -f /etc/apt/sources.list.d/* || true; \
    echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4; \
    for i in 1 2 3; do apt-get update -o Acquire::Retries=3 && break || sleep 5; done; \
    apt-get install -y --no-install-recommends postgresql-client curl ca-certificates; \
    rm -rf /var/lib/apt/lists/*

# --- Python deps ---
COPY ../backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Копируем проект ---
COPY ../backend/ .

# --- Непривилегированный пользователь ---
RUN useradd --create-home --shell /bin/bash app \
    && chown -R www-data:www-data /app \
    && mkdir -p /app/backend/media \
    && chown -R www-data:www-data /app/backend/media

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python manage.py check --deploy || exit 1

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
