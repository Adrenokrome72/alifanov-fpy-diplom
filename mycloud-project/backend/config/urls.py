# backend/config/urls.py
import os
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.http import FileResponse, Http404

urlpatterns = [
    path("admin/", admin.site.urls),
    # все API роуты (cloud/urls.py) должны быть под префиксом api/
    path("api/", include("cloud.urls")),
]

# SPA index view — отдать static/frontend/index.html для всех путей, НЕ начинающихся с /api/
def spa_index(request):
    """
    Отдаёт сгенерированный фронтендом index.html.
    Убедитесь, что вы выполнили `npm run build` и файлы лежат в backend/static/frontend/.
    """
    # Берём BASE_DIR из settings — может быть Path или str
    base = getattr(settings, "BASE_DIR", None)
    # Поддерживаем оба варианта: Path и str
    if isinstance(base, Path):
        index_path = base / "static" / "frontend" / "index.html"
    else:
        index_path = os.path.join(base or "", "static", "frontend", "index.html")

    # index_path может быть Path или str
    try:
        # Для Path -> convert to str
        p = str(index_path)
        if os.path.exists(p):
            return FileResponse(open(p, "rb"), content_type="text/html")
    except Exception:
        pass
    raise Http404("index.html not found. Run `npm run build` in frontend to generate static files.")

# Catch-all: любые URL не начинающиеся с /api/ попадут сюда (должно быть последним)
urlpatterns += [
    re_path(r"^(?!api/).*$", spa_index),
]
