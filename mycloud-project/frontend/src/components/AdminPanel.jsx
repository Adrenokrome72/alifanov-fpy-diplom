// frontend/src/components/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import apiFetch from "../api";
import formatBytes from "../utils/formatBytes";
import { showToast } from "../utils/toast";

/*
  AdminPanel: если у пользователя нет profile.used_bytes или files_count,
  делает доп. запрос к админ-деталям /api/admin-users/{id}/ и подставляет данные.
  Имеет локальный parseBytes для удобства (15GB / 500MB).
*/

function parseBytes(input) {
  if (!input && input !== 0) return null;
  if (typeof input === "number") return input;
  const s = String(input).trim();
  if (s === "") return null;
  const m = s.match(/^([\d,.]+)\s*(b|kb|mb|gb|tb)?$/i);
  if (!m) return null;
  let v = parseFloat(m[1].replace(",", "."));
  const unit = (m[2] || "").toLowerCase();
  switch (unit) {
    case "tb": v = v * 1024 * 1024 * 1024 * 1024; break;
    case "gb": v = v * 1024 * 1024 * 1024; break;
    case "mb": v = v * 1024 * 1024; break;
    case "kb": v = v * 1024; break;
    case "b":
    case "":
    default: break;
  }
  return Math.round(v);
}

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [editingQuota, setEditingQuota] = useState({});
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin-users/");
      const arr = Array.isArray(res) ? res : [];
      setUsers(arr);
      const map = {};
      arr.forEach(u => map[u.id] = (u.profile && u.profile.quota) ? String(u.profile.quota) : "");
      setEditingQuota(map);

      // For users missing used_bytes or files_count do extra GET
      const need = arr.filter(u => !u.profile || (u.profile.used_bytes == null) || (u.files_count == null));
      if (need.length) {
        const promises = need.map(u => apiFetch(`/api/admin-users/${u.id}/`).catch(()=>null));
        const details = await Promise.all(promises);
        setUsers(prev => {
          const byId = new Map(prev.map(x => [x.id, x]));
          details.forEach(d => {
            if (d && d.id) {
              const prevItem = byId.get(d.id) || {};
              byId.set(d.id, { ...prevItem, ...d });
            }
          });
          return Array.from(byId.values());
        });
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка загрузки пользователей", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const saveQuota = async (id) => {
    const raw = editingQuota[id];
    const parsed = parseBytes(raw);
    if (parsed === null) {
      showToast("Неверный формат квоты. Пример: 15GB или 500MB", { type: "error" });
      return;
    }
    try {
      await apiFetch(`/api/admin-users/${id}/set_quota/`, { method: "POST", body: { quota: parsed } });
      showToast("Квота сохранена", { type: "success" });
      await loadUsers();
      if (window.fetchCurrentUser) window.fetchCurrentUser();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка сохранения квоты", { type: "error" });
    }
  };

  const toggleAdmin = async (id, makeAdmin) => {
    try {
      await apiFetch(`/api/admin-users/${id}/set_admin/`, { method: "POST", body: { is_staff: !!makeAdmin } });
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
      showToast(err.message || "Ошибка удаления", { type: "error" });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="card">
        <h2 className="font-semibold">Административная панель</h2>
        <div className="text-sm text-gray-600 mt-2">Управление пользователями и квотами</div>

        {loading ? <div>Загрузка...</div> : (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {users.map(u => (
              <div key={u.id} className="admin-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 8, borderBottom: "1px solid #eee" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div><strong>{u.username}</strong> — {u.full_name || (u.profile && u.profile.full_name) || "—"}</div>
                  <div className="text-xs text-gray-500">
                    Занято: {formatBytes(u.profile?.used_bytes ?? (u.used_bytes ?? 0))}
                    {" • "}
                    Файлов: { (u.files_count != null) ? u.files_count : (u.files_count === 0 ? 0 : (u.profile?.files_count != null ? u.profile.files_count : "—")) }
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={editingQuota[u.id] ?? ""} onChange={(e) => setEditingQuota(prev => ({ ...prev, [u.id]: e.target.value }))} placeholder="Например 15GB" className="border p-1 rounded" />
                  <button className="btn" onClick={() => saveQuota(u.id)}>Сохранить</button>
                  <button className="btn" onClick={() => toggleAdmin(u.id, !u.is_staff)}>{u.is_staff ? "Отнять права" : "Сделать админом"}</button>
                  <button className="btn" onClick={() => toggleActive(u.id)}>{u.is_active ? "Отключить" : "Включить"}</button>
                  <button className="btn" onClick={() => deleteUser(u.id)}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
