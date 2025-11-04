// frontend/src/components/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminUsers,
  setUserQuota,
  setUserAdmin,
  toggleUserActive,
  deleteUser,
} from "../features/adminSlice";
import formatBytes from "../utils/formatBytes";

/**
 * AdminPanel - list users, set quota, toggle admin/active, delete user.
 *
 * Requires store to include admin reducer and apiFetch to be working.
 */

export default function AdminPanel() {
  const dispatch = useDispatch();
  const users = useSelector((s) => s.admin.users || []);
  const status = useSelector((s) => s.admin.status);
  const error = useSelector((s) => s.admin.error);
  const [editingQuota, setEditingQuota] = useState({}); // { userId: quotaValue }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dispatch(fetchAdminUsers());
  }, [dispatch]);

  const refresh = () => dispatch(fetchAdminUsers());

  const onQuotaChange = (id, value) => {
    setEditingQuota((p) => ({ ...p, [id]: value }));
  };

  const saveQuota = async (id) => {
    const raw = editingQuota[id];
    const q = Number(raw);
    if (!Number.isFinite(q) || q < 0) {
      alert("Quota must be a non-negative integer (bytes).");
      return;
    }
    setBusy(true);
    try {
      await dispatch(setUserQuota({ id, quota: q })).unwrap();
      await refresh();
      alert("Quota updated");
    } catch (err) {
      console.error(err);
      alert("Failed to set quota");
    } finally {
      setBusy(false);
    }
  };

  const toggleAdmin = async (id, current) => {
    setBusy(true);
    try {
      await dispatch(setUserAdmin({ id, is_admin: !current })).unwrap();
      await refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to change admin flag");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id, current) => {
    setBusy(true);
    try {
      await dispatch(toggleUserActive({ id, is_active: !current })).unwrap();
      await refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to toggle active");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete user and ALL their data? This is irreversible. Click OK to proceed.")) return;
    setBusy(true);
    try {
      // ask purge = true to remove files
      await dispatch(deleteUser({ id, purge: true })).unwrap();
      await refresh();
      alert("User deleted");
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Admin — Users</h1>

      {status === "loading" && <div className="mb-4">Loading users…</div>}
      {error && <div className="mb-4 text-red-600">Error: {String(error)}</div>}

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-white p-3 rounded shadow flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-semibold text-lg">
                {u.username}{" "}
                {u.is_staff && <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">ADMIN</span>}
                {!u.is_active && <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">DISABLED</span>}
              </div>
              <div className="text-sm text-gray-600">{u.email}</div>
              <div className="text-xs text-gray-500 mt-1">Files: {u.files_count ?? 0} — Used: {formatBytes(u.files_size ?? 0)}</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  className="border p-1 rounded w-36"
                  value={editingQuota[u.id] ?? (u.quota ?? "")}
                  onChange={(e) => onQuotaChange(u.id, e.target.value)}
                  placeholder="quota (bytes)"
                />
                <button
                  onClick={() => saveQuota(u.id)}
                  className="px-3 py-1 bg-sky-600 text-white rounded"
                  disabled={busy}
                >
                  Set quota
                </button>
              </div>

              <button
                onClick={() => toggleAdmin(u.id, u.is_staff)}
                className="px-3 py-1 border rounded"
                disabled={busy}
              >
                {u.is_staff ? "Revoke admin" : "Make admin"}
              </button>

              <button
                onClick={() => toggleActive(u.id, u.is_active)}
                className="px-3 py-1 border rounded"
                disabled={busy}
              >
                {u.is_active ? "Disable" : "Enable"}
              </button>

              <button
                onClick={() => onDelete(u.id)}
                className="px-3 py-1 bg-red-600 text-white rounded"
                disabled={busy}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {users.length === 0 && status !== "loading" && (
          <div className="text-sm text-gray-500">No users found.</div>
        )}
      </div>
    </div>
  );
}
