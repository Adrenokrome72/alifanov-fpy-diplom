import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import apiFetch from "../api";

export const fetchAdminUsers = createAsyncThunk("admin/fetchUsers", async (_, thunkAPI) => {
  try {
    const data = await apiFetch("/api/admin-users/");
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err);
  }
});

export const setUserQuota = createAsyncThunk("admin/setQuota", async ({ id, quota }, thunkAPI) => {
  try {
    const res = await apiFetch(`/api/admin-users/${id}/set_quota/`, { method: "POST", body: { quota } });
    return { id, quota: res.quota ?? quota };
  } catch (err) {
    return thunkAPI.rejectWithValue(err);
  }
});

export const setUserAdmin = createAsyncThunk("admin/setAdmin", async ({ id, is_admin }, thunkAPI) => {
  try {
    await apiFetch(`/api/admin-users/${id}/set_admin/`, { method: "POST", body: { is_staff: is_admin } });
    return { id, is_staff: !!is_admin };
  } catch (err) {
    return thunkAPI.rejectWithValue(err);
  }
});

export const toggleUserActive = createAsyncThunk("admin/toggleActive", async ({ id, is_active }, thunkAPI) => {
  try {
    const res = await apiFetch(`/api/admin-users/${id}/toggle_active/`, { method: "POST", body: { is_active } });
    return { id, is_active: res.is_active ?? is_active };
  } catch (err) {
    return thunkAPI.rejectWithValue(err);
  }
});

export const deleteUser = createAsyncThunk("admin/deleteUser", async ({ id, purge = false }, thunkAPI) => {
  try {
    const query = purge ? "?purge=true" : "";
    await apiFetch(`/api/admin-users/${id}/${query}`, { method: "DELETE" });
    return id;
  } catch (err) {
    return thunkAPI.rejectWithValue(err);
  }
});

const slice = createSlice({
  name: "admin",
  initialState: { users: [], status: "idle", error: null },
  reducers: { clearAdminState(state) { state.users = []; state.status = "idle"; state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchAdminUsers.fulfilled, (s, a) => { s.users = a.payload || []; s.status = "idle"; });
    b.addCase(fetchAdminUsers.pending, (s) => { s.status = "loading"; });
    b.addCase(fetchAdminUsers.rejected, (s, a) => { s.status = "error"; s.error = a.payload || a.error; });

    b.addCase(setUserQuota.fulfilled, (s, a) => {
      const idx = s.users.findIndex(u => u.id === a.payload.id);
      if (idx !== -1) s.users[idx].profile = { ...(s.users[idx].profile || {}), quota: a.payload.quota };
    });

    b.addCase(setUserAdmin.fulfilled, (s, a) => {
      const idx = s.users.findIndex(u => u.id === a.payload.id);
      if (idx !== -1) s.users[idx].is_staff = a.payload.is_staff;
    });

    b.addCase(toggleUserActive.fulfilled, (s, a) => {
      const idx = s.users.findIndex(u => u.id === a.payload.id);
      if (idx !== -1) s.users[idx].is_active = a.payload.is_active;
    });

    b.addCase(deleteUser.fulfilled, (s, a) => {
      s.users = s.users.filter(u => u.id !== a.payload);
    });
  }
});

export const { clearAdminState } = slice.actions;
export default slice.reducer;
