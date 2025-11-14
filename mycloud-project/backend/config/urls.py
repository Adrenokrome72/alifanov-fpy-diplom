import os
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.http import FileResponse, Http404

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("cloud.urls")),
]

def spa_index(request):
    base = getattr(settings, "BASE_DIR", None)
    if isinstance(base, Path):
        index_path = base / "static" / "frontend" / "index.html"
    else:
        index_path = os.path.join(base or "", "static", "frontend", "index.html")

    try:
        p = str(index_path)
        if os.path.exists(p):
            return FileResponse(open(p, "rb"), content_type="text/html")
    except Exception:
        pass
    raise Http404("index.html not found. Run `npm run build` in frontend to generate static files.")

urlpatterns += [
    re_path(r"^(?!api/).*$", spa_index),
]
