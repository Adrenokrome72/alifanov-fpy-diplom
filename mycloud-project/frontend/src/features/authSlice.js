// frontend/src/features/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../api';

// Регистрация (как было)
export const register = createAsyncThunk('auth/register', async (payload) => {
  return await apiFetch('/api/auth/register/', { method: 'POST', body: payload });
});

// Логин — после успешного логина подтягиваем данные пользователя
export const login = createAsyncThunk('auth/login', async (payload, thunkAPI) => {
  await apiFetch('/api/auth/login/', { method: 'POST', body: payload });
  // после успешного login — получить данные текущего пользователя
  const user = await apiFetch('/api/auth/me/');
  return user;
});

// Выход
export const logout = createAsyncThunk('auth/logout', async () => {
  return await apiFetch('/api/auth/logout/', { method: 'POST' });
});

// Получить текущего пользователя (при старте приложения)
export const fetchCurrentUser = createAsyncThunk('auth/fetchCurrentUser', async () => {
  try {
    const user = await apiFetch('/api/auth/me/');
    return user;
  } catch (e) {
    // если не аутентифицирован — вернём null
    return null;
  }
});

const slice = createSlice({
  name: 'auth',
  initialState: { user: null, status: 'idle', error: null },
  reducers: {
    setUser(state, action) { state.user = action.payload; }
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.fulfilled, (state) => { state.status = 'registered'; })
      .addCase(register.rejected, (state, action) => { state.status = 'error'; state.error = action.error; })
      .addCase(login.fulfilled, (state, action) => { state.status = 'authenticated'; state.user = action.payload; })
      .addCase(login.rejected, (state, action) => { state.status = 'error'; state.error = action.error; })
      .addCase(logout.fulfilled, (state) => { state.status = 'loggedout'; state.user = null; })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => { state.user = action.payload; });
  }
});

export const { setUser } = slice.actions;
export default slice.reducer;
