// frontend/src/api.js
// Central API helper. Default export is apiFetch(path, opts) returning parsed JSON or throwing {status, data}.
// Also exports getCsrfToken() and postForm helper for FormData file upload.

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return v ? v.pop() : null;
}

export function getCsrfToken() {
  return getCookie('csrftoken') || getCookie('csrf') || null;
}

async function parseJSONOrText(resp) {
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return resp.json();
  } else {
    return resp.text();
  }
}

export default async function apiFetch(path, opts = {}) {
  const base = '';
  const url = path.startsWith('http') ? path : (base + path);
  const headers = opts.headers ? { ...opts.headers } : {};

  let body = opts.body;
  if (body && !(body instanceof FormData) && typeof body === 'object' && opts.method && opts.method.toUpperCase() !== 'GET') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = JSON.stringify(body);
  }

  // CSRF for stateful endpoints (POST/PATCH/PUT/DELETE)
  const method = (opts.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRFToken'] = csrf;
  }

  const resp = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body,
  });

  if (resp.ok) {
    const disposition = resp.headers.get('content-disposition') || '';
    if (disposition.toLowerCase().includes('attachment')) {
      return resp;
    }
    const data = await parseJSONOrText(resp);
    return data;
  } else {
    let data;
    try {
      data = await parseJSONOrText(resp);
    } catch (e) {
      data = resp.statusText || 'Error';
    }
    const err = { status: resp.status, data };
    throw err;
  }
}

export async function postForm(path, formData) {
  const headers = {};
  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRFToken'] = csrf;
  const resp = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });
  if (resp.ok) {
    const ct = (resp.headers.get('content-type') || '');
    if (ct.includes('application/json')) return resp.json();
    return resp;
  } else {
    let data;
    try { data = await resp.json(); } catch(e){ data = await resp.text(); }
    throw { status: resp.status, data };
  }
}
