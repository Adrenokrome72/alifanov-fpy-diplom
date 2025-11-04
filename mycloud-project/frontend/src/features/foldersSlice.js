// frontend/src/features/foldersSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../api';

/*
  fetchFolders() -> GET /api/folders/
  createFolder({ name, parent }) -> POST /api/folders/
  renameFolder({ id, name }) -> POST /api/folders/{id}/rename/
  moveFolder({ id, parent }) -> POST /api/folders/{id}/move/
  deleteFolder({ id }) -> DELETE /api/folders/{id}/
*/

export const fetchFolders = createAsyncThunk('folders/fetch', async () => {
  const data = await apiFetch('/api/folders/');
  return data;
});

export const createFolder = createAsyncThunk('folders/create', async ({ name, parent = null }) => {
  const body = { name };
  if (parent !== null) body.parent = parent;
  const res = await apiFetch('/api/folders/', { method: 'POST', body });
  return res;
});

export const renameFolder = createAsyncThunk('folders/rename', async ({ id, name }) => {
  const res = await apiFetch(`/api/folders/${id}/rename/`, { method: 'POST', body: { name } });
  return res;
});

export const moveFolder = createAsyncThunk('folders/move', async ({ id, parent = null }) => {
  const res = await apiFetch(`/api/folders/${id}/move/`, { method: 'POST', body: { parent } });
  return res;
});

export const deleteFolder = createAsyncThunk('folders/delete', async ({ id }) => {
  await apiFetch(`/api/folders/${id}/`, { method: 'DELETE' });
  return id;
});

const slice = createSlice({
  name: 'folders',
  initialState: { items: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchFolders.fulfilled, (s, a) => { s.items = a.payload || []; s.status = 'idle'; });
    b.addCase(fetchFolders.pending, (s) => { s.status = 'loading'; });
    b.addCase(fetchFolders.rejected, (s, a) => { s.status = 'error'; s.error = a.error; });

    b.addCase(createFolder.fulfilled, (s, a) => {
      // New folder appended
      s.items.push(a.payload);
    });
    b.addCase(renameFolder.fulfilled, (s, a) => {
      // backend returned {detail:'renamed', name: ...} — but serializer may vary.
      // Safer to re-fetch or update locally if id present.
      const idx = s.items.findIndex(x => x.id === a.meta.arg.id);
      if (idx !== -1) s.items[idx] = { ...s.items[idx], name: a.meta.arg.name || s.items[idx].name };
    });
    b.addCase(deleteFolder.fulfilled, (s, a) => {
      s.items = s.items.filter(x => x.id !== a.payload);
    });
  }
});

export default slice.reducer;
