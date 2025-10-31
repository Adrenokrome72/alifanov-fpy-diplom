export function apiFetch(path, options = {}){
  const opts = {
    credentials: 'include',
    headers: {},
    ...options,
  };
  if (opts.body && !(opts.body instanceof FormData)){
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  return fetch(path, opts).then(async res => {
    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) data = await res.json();
    else data = await res.text();
    if (!res.ok) throw { status: res.status, data };
    return data;
  });
}

export function getCsrfToken(){
  // simple cookie parser for csrftoken
  const match = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
  return match ? match.pop() : '';
}