// frontend/src/components/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import apiFetch from "../api";
import parseBytes from "../utils/parseBytes";
import formatBytes from "../utils/formatBytes";
import { showToast } from "../utils/toast";

/**
 * Admin panel expects backend endpoints:
 * GET  /api/admin-users/                -> list users with profile
 * POST /api/admin-users/{id}/set_quota/ -> set quota (body: { quota: <bytes> })
 * (adjust endpoints if your backend differs)
 */

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [editingQuota, setEditingQuota] = useState({});
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin-users/");
      setUsers(Array.isArray(data) ? data : []);
      const map = {};
      (data || []).forEach(u => {
        map[u.id] = u.profile?.quota != null ? String(u.profile.quota) : "";
      });
      setEditingQuota(map);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось загрузить пользователей", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const saveQuota = async (id) => {
    const raw = editingQuota[id];
    const parsed = parseBytes(raw);
    if (parsed === null) {
      showToast("Неверный формат квоты. Используйте 15GB или 500MB или число (байты).", { type: "error" });
      return;
    }
    try {
      // backend route per your URLconf: admin-users/{pk}/set_quota/
      await apiFetch(`/api/admin-users/${id}/set_quota/`, { method: "POST", body: { quota: parsed } });
      showToast("Квота сохранена", { type: "success" });
      await loadUsers();
      // also ask frontend to refresh user profile if global fn present
      if (window.fetchCurrentUser) await window.fetchCurrentUser();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка сохранения квоты", { type: "error" });
    }
  };

  const toggleAdmin = async (id, makeAdmin) => {
    try {
      await apiFetch(`/api/admin-users/${id}/set_admin/`, { method: "POST", body: { is_admin: !!makeAdmin } });
      showToast("Роль обновлена", { type: "success" });
      await loadUsers();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка обновления роли", { type: "error" });
    }
  };

  const toggleActive = async (id) => {
    try {
      await apiFetch(`/api/admin-users/${id}/toggle_active/`, { method: "POST", body: {} });
      showToast("Статус пользователя обновлён", { type: "success" });
      await loadUsers();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка обновления статуса", { type: "error" });
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Удалить пользователя и его данные?")) return;
    try {
      await apiFetch(`/api/admin-users/${id}/`, { method: "DELETE" });
      showToast("Пользователь удалён", { type: "success" });
      await loadUsers();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка удаления пользователя", { type: "error" });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="card">
        <h2 className="font-semibold">Административная панель</h2>
        <div className="text-sm text-gray-600 mt-2">Управление пользователями и квотами</div>

        {loading ? <div>Loading...</div> : (
          <div style={{marginTop:12, display:"grid", gap:8}}>
            {users.map(u => (
              <div key={u.id} className="admin-row" style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:8, borderBottom:"1px solid #eee"}}>
                <div style={{display:"flex", flexDirection:"column"}}>
                  <div><strong>{u.username}</strong> — {u.full_name || u.profile?.full_name || ""}</div>
                  <div className="text-xs text-gray-500">Used: {formatBytes(u.profile?.used_bytes ?? 0)}</div>
                </div>

                <div style={{display:"flex", gap:8, alignItems:"center"}}>
                  <input
                    value={editingQuota[u.id] ?? ""}
                    onChange={(e)=>setEditingQuota(prev=>({ ...prev, [u.id]: e.target.value }))}
                    placeholder="Например 15GB или 500MB"
                    className="border p-1 rounded"
                  />
                  <button className="btn" onClick={() => saveQuota(u.id)}>Save</button>

                  <button className="btn" onClick={() => toggleAdmin(u.id, !u.is_staff)}>{u.is_staff ? "Revoke Admin" : "Make Admin"}</button>
                  <button className="btn" onClick={() => toggleActive(u.id)}>{u.is_active ? "Disable" : "Enable"}</button>
                  <button className="btn" onClick={() => deleteUser(u.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
