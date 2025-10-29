// frontend/src/api/axios.js
import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE || '/api', // <- относительный путь, работает через CRA proxy
  withCredentials: true
});

/**
 * Инициирует CSRF: делает GET /api/users/csrf/ (сервер должен установить csrftoken cookie).
 * Затем устанавливает header X-CSRFToken из cookie для axios.
 */
export async function initCsrf() {
  try {
    // запрос, который сервер должен обрабатывать с @ensure_csrf_cookie
    await api.get('/users/csrf/');
  } catch (err) {
    // не фатально — всё равно попытаемся прочитать cookie
    // console.warn('initCsrf GET failed', err);
  }
  setCSRFCookieHeader();
}

/** считывает cookie 'csrftoken' и ставит заголовок */
export function setCSRFCookieHeader() {
  const token = Cookies.get('csrftoken');
  if (token) {
    api.defaults.headers.common['X-CSRFToken'] = token;
  } else {
    delete api.defaults.headers.common['X-CSRFToken'];
  }
}

export default api;
