// frontend/src/api.js
export function getCsrfToken(){
  // корректный regex: один обратный слэш в source
  const m = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
  return m ? m.pop() : '';
}

export async function apiFetch(path, options = {}) {
  const opts = {
    credentials: 'include',
    headers: { ...(options.headers || {}) },
    method: options.method || 'GET',
    ...options,
  };

  // Если body есть и это не FormData, сериализуем в JSON
  if (opts.body && !(opts.body instanceof FormData)) {
    if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    if (typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  }

  const method = (opts.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    const csrftoken = getCsrfToken();
    if (csrftoken) {
      // добавляем X-CSRFToken заголовок
      opts.headers['X-CSRFToken'] = csrftoken;
    }
  }

  const res = await fetch(path, opts);
  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) data = await res.json();
  else data = await res.text();
  if (!res.ok) throw { status: res.status, data };
  return data;
}
