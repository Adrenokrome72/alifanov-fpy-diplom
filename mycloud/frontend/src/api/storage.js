// frontend/src/api/storage.js
import api from './axios'; // уже есть
import Cookies from 'js-cookie';

export async function initCsrf() {
  try {
    await api.get('/users/csrf/');
  } catch(e) {}
  const token = Cookies.get('csrftoken');
  if (token) api.defaults.headers.common['X-CSRFToken'] = token;
}

export async function createFolder(name, parent=null){
  return api.post('/storage/folders/create/', { name, parent });
}

export async function listFolders(){
  return api.get('/storage/folders/');
}

export async function uploadFile(file, comment='', folder=null){
  const fd = new FormData();
  fd.append('file', file);
  fd.append('comment', comment);
  if (folder !== null) fd.append('folder', String(folder));
  return api.post('/storage/files/upload/', fd, { headers: {'Content-Type':'multipart/form-data'} });
}

export async function listFiles(folder_id=null, order_by=null){
  const params = {};
  if (folder_id !== null) params.folder_id = folder_id;
  if (order_by) params.order_by = order_by;
  return api.get('/storage/files/', { params });
}

export async function downloadFile(id){
  return api.get(`/storage/files/${id}/download/`, { responseType: 'blob' });
}

export async function createShare(type, id, expires_at=null){
  return api.post('/storage/share/create/', { type, id, expires_at });
}
