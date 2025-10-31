import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../api';

export const fetchFiles = createAsyncThunk('files/fetch', async (params) => {
  return await apiFetch('/api/files/');
});

export const uploadFile = createAsyncThunk('files/upload', async (formData) => {
  // use native fetch for FormData to avoid JSON header
  const res = await fetch('/api/files/', { method: 'POST', body: formData, credentials: 'include' });
  if (!res.ok) throw { status: res.status, data: await res.text() };
  return await res.json();
});

const slice = createSlice({
  name: 'files',
  initialState: { items: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFiles.fulfilled, (state, action) => { state.items = action.payload || []; })
      .addCase(uploadFile.fulfilled, (state, action) => { state.items.unshift(action.payload); });
  }
});

export default slice.reducer;