import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../api';

export const register = createAsyncThunk('auth/register', async (payload) => {
  return await apiFetch('/api/auth/register/', { method: 'POST', body: payload });
});

export const login = createAsyncThunk('auth/login', async (payload) => {
  return await apiFetch('/api/auth/login/', { method: 'POST', body: payload });
});

export const logout = createAsyncThunk('auth/logout', async () => {
  return await apiFetch('/api/auth/logout/', { method: 'POST' });
});

const slice = createSlice({
  name: 'auth',
  initialState: { user: null, status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(register.fulfilled, (state, action) => { state.status = 'registered'; })
      .addCase(register.rejected, (state, action) => { state.status = 'error'; state.error = action.error; })
      .addCase(login.fulfilled, (state, action) => { state.status = 'authenticated'; state.user = action.payload.username || null; })
      .addCase(logout.fulfilled, (state, action) => { state.status = 'loggedout'; state.user = null; });
  }
});

export default slice.reducer;