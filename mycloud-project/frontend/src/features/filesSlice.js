// frontend/src/features/filesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../api';

/*
  fetchFiles({ folder }) -> GET /api/files/?folder=<id>
  uploadFile({ file, folder, comment }) -> POST /api/files/ (FormData)
  renameFile({ id, name }) -> PATCH /api/files/{id}/
  moveFile({ id, folder }) -> POST /api/files/{id}/move/
  shareFile({ id }) -> POST /api/files/{id}/share/
  deleteFile({ id }) -> DELETE /api/files/{id}/
*/

export const fetchFiles = createAsyncThunk('files/fetch', async ({ folder } = {}) => {
  let url = '/api/files/';
  if (folder !== undefined && folder !== null) {
    url += `?folder=${encodeURIComponent(folder)}`;
  }
  const data = await apiFetch(url);
  return data;
});

export const uploadFile = createAsyncThunk('files/upload', async ({ file, folder = null, comment = "" }) => {
  const fd = new FormData();
  fd.append('file', file);
  if (folder) fd.append('folder', folder);
  if (comment) fd.append('comment', comment);
  // apiFetch handles FormData correctly (won't JSON.stringify)
  const res = await apiFetch('/api/files/', { method: 'POST', body: fd });
  return res;
});

export const renameFile = createAsyncThunk('files/rename', async ({ id, name }) => {
  // backend supports PATCH to update original_name
  const res = await apiFetch(`/api/files/${id}/`, { method: 'PATCH', body: { original_name: name } });
  return res;
});

export const moveFile = createAsyncThunk('files/move', async ({ id, folder = null }) => {
  const body = { folder };
  const res = await apiFetch(`/api/files/${id}/move/`, { method: 'POST', body });
  return res;
});

export const shareFile = createAsyncThunk('files/share', async ({ id }) => {
  const res = await apiFetch(`/api/files/${id}/share/`, { method: 'POST' });
  // res expected to contain { share_token, share_url } (per backend)
  return { id, ...res };
});

export const deleteFile = createAsyncThunk('files/delete', async ({ id }) => {
  await apiFetch(`/api/files/${id}/`, { method: 'DELETE' });
  return id;
});

const slice = createSlice({
  name: 'files',
  initialState: { items: [], status: 'idle', error: null },
  reducers: {
    clearFiles(state) { state.items = []; }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFiles.pending, (s) => { s.status = 'loading'; })
      .addCase(fetchFiles.fulfilled, (s, a) => { s.items = a.payload || []; s.status = 'idle'; })
      .addCase(fetchFiles.rejected, (s, a) => { s.status = 'error'; s.error = a.error; })

      .addCase(uploadFile.fulfilled, (s, a) => {
        // Add new file to top
        if (a.payload) s.items.unshift(a.payload);
      })
      .addCase(uploadFile.rejected, (s, a) => { s.error = a.error; })

      .addCase(renameFile.fulfilled, (s, a) => {
        const idx = s.items.findIndex(x => x.id === a.payload.id);
        if (idx !== -1) s.items[idx] = { ...s.items[idx], ...a.payload };
      })

      .addCase(moveFile.fulfilled, (s, a) => {
        // backend returns {detail: 'moved', folder: <id|null>}
        const idMatch = /\/api\/files\/(\d+)\//.exec(a.meta.arg ? a.meta.arg.id : '');
        // safe fallback: a.meta.arg.id
        const fid = (a.meta && a.meta.arg && a.meta.arg.id) || null;
        if (fid) {
          const idx = s.items.findIndex(x => x.id === fid);
          if (idx !== -1) {
            s.items[idx] = { ...s.items[idx], folder: a.payload.folder || null };
          }
        }
      })

      .addCase(shareFile.fulfilled, (s, a) => {
        const idx = s.items.findIndex(x => x.id === a.payload.id);
        if (idx !== -1) {
          s.items[idx] = { ...s.items[idx], share_token: a.payload.share_token, share_url: a.payload.share_url, is_shared: true };
        }
      })

      .addCase(deleteFile.fulfilled, (s, a) => {
        s.items = s.items.filter(x => x.id !== a.payload);
      });
  }
});

export const { clearFiles } = slice.actions;
export default slice.reducer;
