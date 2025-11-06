// frontend/src/features/filesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiFetch, { postForm } from '../api';
import { fetchCurrentUser } from './authSlice';
import { showToast } from '../utils/toast';

// fetch files for current user or for specific folder
export const fetchFiles = createAsyncThunk(
  'files/fetchFiles',
  async ({ folder = null, owner = null } = {}, thunkAPI) => {
    try {
      const qs = [];
      if (folder) qs.push(`folder=${folder}`);
      if (owner) qs.push(`owner=${owner}`);
      const q = qs.length ? `?${qs.join('&')}` : '';
      const data = await apiFetch(`/api/files/${q}`);
      // ensure current profile updated
      try { await thunkAPI.dispatch(fetchCurrentUser()); } catch(e){/*ignore*/}
      return { files: data, folder, owner };
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

// upload file (with optional folder and comment)
export const uploadFile = createAsyncThunk(
  'files/uploadFile',
  async ({ file, folder = null, comment = '' }, thunkAPI) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (folder) fd.append('folder', folder);
      if (comment) fd.append('comment', comment);
      const data = await postForm('/api/files/', fd);
      // refresh user usage
      try { await thunkAPI.dispatch(fetchCurrentUser()); } catch(e){/*ignore*/}
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const moveFile = createAsyncThunk(
  'files/moveFile',
  async ({ id, folder = null }, thunkAPI) => {
    try {
      const payload = { folder };
      const data = await apiFetch(`/api/files/${id}/move/`, { method: 'POST', body: payload });
      // refresh files and user usage
      try { await thunkAPI.dispatch(fetchFiles({})); } catch(e){/*ignore*/}
      try { await thunkAPI.dispatch(fetchCurrentUser()); } catch(e){/*ignore*/}
      return { id, folder, data };
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const renameFile = createAsyncThunk(
  'files/renameFile',
  async ({ id, newName }, thunkAPI) => {
    try {
      const payload = { original_name: newName };
      const data = await apiFetch(`/api/files/${id}/`, { method: 'PATCH', body: payload });
      // refresh file list
      try { await thunkAPI.dispatch(fetchFiles({})); } catch(e){/*ignore*/}
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const deleteFile = createAsyncThunk(
  'files/deleteFile',
  async ({ id }, thunkAPI) => {
    try {
      const resp = await apiFetch(`/api/files/${id}/`, { method: 'DELETE' });
      try { await thunkAPI.dispatch(fetchFiles({})); } catch(e){/*ignore*/}
      try { await thunkAPI.dispatch(fetchCurrentUser()); } catch(e){/*ignore*/}
      return { id };
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

// share/unshare file
export const shareFile = createAsyncThunk(
  'files/shareFile',
  async ({ id, action = 'generate' }, thunkAPI) => {
    try {
      const data = await apiFetch(`/api/files/${id}/share/`, { method: 'POST', body: { action } });
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

// download file (just open in new tab)
export const downloadFile = createAsyncThunk(
  'files/downloadFile',
  async ({ id }, thunkAPI) => {
    try {
      // backend returns attachment; apiFetch returns Response if attachment
      const resp = await apiFetch(`/api/files/${id}/download/`);
      if (resp && resp.blob) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        // try to get filename from content-disposition
        const disp = resp.headers.get('content-disposition') || '';
        let filename = null;
        const match = disp.match(/filename\*=UTF-8''([^;]+)/) || disp.match(/filename="?([^"]+)"?/);
        if (match) filename = decodeURIComponent(match[1]);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        // fallback: navigate to endpoint (session auth works)
        window.location.href = `/api/files/${id}/download/`;
      }
      // refresh current user usage and file metadata
      try { await thunkAPI.dispatch(fetchCurrentUser()); } catch(e){/*ignore*/}
      try { await thunkAPI.dispatch(fetchFiles({})); } catch(e){/*ignore*/}
      return { id };
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

const slice = createSlice({
  name: 'files',
  initialState: {
    items: [], // files visible in current folder
    loading: false,
    error: null,
    selected: null,
  },
  reducers: {
    setFiles(state, action) {
      state.items = action.payload || [];
    },
    setSelected(state, action) {
      state.selected = action.payload;
    },
    clearSelected(state) {
      state.selected = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFiles.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchFiles.fulfilled, (s, a) => { s.loading = false; s.items = a.payload.files || a.payload; })
      .addCase(fetchFiles.rejected, (s, a) => { s.loading = false; s.error = a.payload || a.error; })

      .addCase(uploadFile.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(uploadFile.fulfilled, (s, a) => {
        s.loading = false;
        // push new file to list (if in same folder)
        const newFile = a.payload;
        if (newFile) {
          s.items = [newFile, ...s.items];
          showToast('Файл загружен', { type: 'success' });
        }
      })
      .addCase(uploadFile.rejected, (s, a) => { s.loading = false; s.error = a.payload || a.error; showToast('Ошибка загрузки', { type: 'error' }); })

      .addCase(moveFile.fulfilled, (s, a) => {
        showToast('Файл перемещён', { type: 'success' });
      })
      .addCase(moveFile.rejected, (s, a) => { showToast('Ошибка перемещения', { type: 'error' }); })

      .addCase(renameFile.fulfilled, (s, a) => {
        showToast('Переименовано', { type: 'success' });
      })
      .addCase(renameFile.rejected, (s, a) => { showToast('Ошибка переименования', { type: 'error' }); })

      .addCase(deleteFile.fulfilled, (s, a) => {
        s.items = s.items.filter(it => it.id !== a.payload.id);
        showToast('Файл удалён', { type: 'success' });
      })
      .addCase(deleteFile.rejected, (s,a) => { showToast('Ошибка удаления', { type: 'error' }) })

      .addCase(shareFile.fulfilled, (s, a) => {
        // a.payload may contain share_url
        if (a.payload && a.payload.share_url) {
          navigator.clipboard?.writeText(a.payload.share_url).then(()=> {
            showToast('Ссылка скопирована в буфер обмена', { type: 'success' });
          }).catch(()=> {
            showToast('Ссылка: ' + a.payload.share_url, { type: 'info' });
          });
        } else {
          showToast('share: done', { type: 'success' });
        }
      })
      .addCase(shareFile.rejected, (s, a) => { showToast('Ошибка шаринга', { type: 'error' }); });
  }
});

export const { setFiles, setSelected, clearSelected } = slice.actions;
export default slice.reducer;
