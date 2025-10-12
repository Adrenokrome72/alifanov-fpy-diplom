import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: '/api',         // проксируется на http://127.0.0.1:8000
  withCredentials: true,   // важно — чтобы браузер отправлял cookie (sessionid, csrftoken)
});

// helper чтобы обновлять заголовок CSRF
export function setCSRFCookieHeader() {
  const token = Cookies.get('csrftoken'); // имя cookie по-умолчанию
  if (token) {
    api.defaults.headers.common['X-CSRFToken'] = token;
  }
}

export default api;