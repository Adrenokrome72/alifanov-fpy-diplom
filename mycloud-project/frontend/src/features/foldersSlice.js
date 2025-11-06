// frontend/src/features/foldersSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiFetch from '../api';
import { fetchCurrentUser } from './authSlice';
import { showToast } from '../utils/toast';

// list top-level folders for current user or owner param
export const fetchFolders = createAsyncThunk(
  'folders/fetchFolders',
  async ({ parent = null, owner = null } = {}, thunkAPI) => {
    try {
      if (owner && thunkAPI) {
        // use admin storage endpoint to get top-level folders/files
        const res = await apiFetch(`/api/admin-users/${owner}/storage/`);
        return { folders: res.folders || [], files: res.files || [], used_bytes: res.used_bytes, quota: res.quota };
      }
      const qs = parent ? `?parent=${parent}` : '';
      const data = await apiFetch(`/api/folders/${qs}`);
      return { folders: data };
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const createFolder = createAsyncThunk(
  'folders/createFolder',
  async ({ name, parent = null }, thunkAPI) => {
    try {
      const payload = { name, parent };
      const data = await apiFetch('/api/folders/', { method: 'POST', body: payload });
      try { await thunkAPI.dispatch(fetchCurrentUser()); } catch(e){/*ignore*/}
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const renameFolder = createAsyncThunk(
  'folders/renameFolder',
  async ({ id, name }, thunkAPI) => {
    try {
      const data = await apiFetch(`/api/folders/${id}/rename/`, { method: 'POST', body: { name } });
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const moveFolder = createAsyncThunk(
  'folders/moveFolder',
  async ({ id, parent = null }, thunkAPI) => {
    try {
      const data = await apiFetch(`/api/folders/${id}/move/`, { method: 'POST', body: { parent } });
      try { await thunkAPI.dispatch(fetchCurrentUser()); } catch(e){/*ignore*/}
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const deleteFolder = createAsyncThunk(
  'folders/deleteFolder',
  async ({ id }, thunkAPI) => {
    try {
      await apiFetch(`/api/folders/${id}/`, { method: 'DELETE' });
      try { await thunkAPI.dispatch(fetchCurrentUser()); } catch(e){/*ignore*/}
      return { id };
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const shareFolder = createAsyncThunk(
  'folders/shareFolder',
  async ({ id, action = 'generate' }, thunkAPI) => {
    try {
      const data = await apiFetch(`/api/folders/${id}/share/`, { method: 'POST', body: { action } });
      // copy link if generation
      if (data && data.share_url) {
        try { await navigator.clipboard.writeText(data.share_url); showToast('Ссылка скопирована', { type: 'success' }); }
        catch (e) { showToast(data.share_url, { type: 'info' }); }
      }
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

const slice = createSlice({
  name: 'folders',
  initialState: {
    list: [],
    loading: false,
    error: null,
    creating: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFolders.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchFolders.fulfilled, (s, a) => {
        s.loading = false;
        if (a.payload.folders) s.list = a.payload.folders;
      })
      .addCase(fetchFolders.rejected, (s, a) => { s.loading = false; s.error = a.payload || a.error; })

      .addCase(createFolder.pending, (s) => { s.creating = true; })
      .addCase(createFolder.fulfilled, (s, a) => { s.creating = false; s.list = [a.payload, ...s.list]; showToast('Папка создана', { type: 'success' }); })
      .addCase(createFolder.rejected, (s, a) => { s.creating = false; showToast('Ошибка создания папки', { type: 'error' }); })

      .addCase(renameFolder.fulfilled, (s, a) => { showToast('Переименовано', { type: 'success' }); })
      .addCase(moveFolder.fulfilled, (s, a) => { showToast('Папка перемещена', { type: 'success' }); })
      .addCase(deleteFolder.fulfilled, (s, a) => {
        s.list = s.list.filter(f => f.id !== a.payload.id);
        showToast('Папка удалена', { type: 'success' });
      });
  }
});

export default slice.reducer;
