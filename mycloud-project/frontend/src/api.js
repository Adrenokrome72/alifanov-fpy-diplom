// frontend/src/api.js
// Унифицированная обёртка для fetch с поддержкой CSRF, FormData и дружелюбной обработкой ошибок.

export function getCsrfToken() {
  const m = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[2]) : "";
}

/**
 * Выполняет запрос к API.
 * - path: полный URL или относительный путь (например '/api/files/')
 * - options: те же опции, что и fetch; если body не FormData, то автоматически сериализуется в JSON
 * - автоматически добавляет credentials: 'include'
 * - автоматически добавляет заголовок X-CSRFToken для "изменяющих" методов
 * - возвращает распарсенный JSON (если Content-Type JSON) или текст/Response по необходимости
 * - при ошибке бросает Error с err.message и err.status/err.data
 */
export async function apiFetch(path, options = {}) {
  const opts = {
    credentials: "include",
    headers: { ...(options.headers || {}) },
    method: options.method || "GET",
    ...options,
  };

  // Если body присутствует и это не FormData — сериализуем в JSON
  if (opts.body && !(opts.body instanceof FormData)) {
    if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
    if (typeof opts.body !== "string") opts.body = JSON.stringify(opts.body);
  }

  const method = (opts.method || "GET").toUpperCase();
  // Для изменяющих методов добавляем CSRF токен из cookie (если есть)
  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    const csrftoken = getCsrfToken();
    if (csrftoken) opts.headers["X-CSRFToken"] = csrftoken;
  }

  const res = await fetch(path, opts);

  const contentType = res.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const message = (data && typeof data === "object" && (data.detail || data.error))
      ? (data.detail || data.error)
      : (typeof data === "string" && data.length ? data : `HTTP ${res.status}`);
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export default apiFetch;
