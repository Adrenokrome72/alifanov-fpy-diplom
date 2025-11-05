// frontend/src/features/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiFetch from '../api';

// Регистрация
export const register = createAsyncThunk('auth/register', async (payload, thunkAPI) => {
  try {
    const res = await apiFetch('/api/auth/register/', { method: 'POST', body: payload });
    return res;
  } catch (err) {
    return thunkAPI.rejectWithValue(err);
  }
});

// Логин — после успешного логина подтягиваем данные пользователя
export const login = createAsyncThunk('auth/login', async (payload, thunkAPI) => {
  try {
    await apiFetch('/api/auth/login/', { method: 'POST', body: payload });
    const user = await apiFetch('/api/auth/me/');
    return user;
  } catch (err) {
    return thunkAPI.rejectWithValue(err);
  }
});

// Выход
export const logout = createAsyncThunk('auth/logout', async (_, thunkAPI) => {
  try {
    await apiFetch('/api/auth/logout/', { method: 'POST', body: {} });
    return true;
  } catch (err) {
    return thunkAPI.rejectWithValue(err);
  }
});

// Получить текущего пользователя (при старте приложения)
export const fetchCurrentUser = createAsyncThunk('auth/fetchCurrentUser', async (_, thunkAPI) => {
  try {
    const user = await apiFetch('/api/auth/me/');
    return user;
  } catch (e) {
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
      .addCase(register.rejected, (state, action) => { state.status = 'error'; state.error = action.payload || action.error; })

      .addCase(login.fulfilled, (state, action) => { state.status = 'authenticated'; state.user = action.payload; })
      .addCase(login.rejected, (state, action) => { state.status = 'error'; state.error = action.payload || action.error; })

      .addCase(logout.fulfilled, (state) => { state.status = 'loggedout'; state.user = null; })
      .addCase(logout.rejected, (state, action) => { state.error = action.payload || action.error; })

      .addCase(fetchCurrentUser.fulfilled, (state, action) => { state.user = action.payload; })
      .addCase(fetchCurrentUser.rejected, (state, action) => { state.user = null; });
  }
});

export const { setUser } = slice.actions;
export default slice.reducer;
