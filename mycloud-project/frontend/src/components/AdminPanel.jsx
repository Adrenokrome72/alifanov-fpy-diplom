// frontend/src/components/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import apiFetch from "../api";
import { showToast } from "../utils/toast";
import formatBytes from "../utils/formatBytes";
import { useNavigate } from "react-router-dom";

/* parse size like '15GB' -> bytes */
function parseSizeToBytes(input) {
  if (!input && input !== 0) return null;
  const s = String(input).trim().toUpperCase();
  if (!s) return null;
  const match = s.match(/^([\d,.]+)\s*(B|KB|K|MB|M|GB|G|TB|T)?$/i);
  if (!match) return null;
  let num = parseFloat(match[1].replace(",", "."));
  if (Number.isNaN(num)) return null;
  const unit = (match[2] || "B").toUpperCase();
  const map = { B: 1, K: 1024, KB: 1024, M: 1024 ** 2, MB: 1024 ** 2, G: 1024 ** 3, GB: 1024 ** 3, T: 1024 ** 4, TB: 1024 ** 4 };
  const factor = map[unit] || 1;
  return Math.round(num * factor);
}

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingQuotaFor, setEditingQuotaFor] = useState(null);
  const [quotaInput, setQuotaInput] = useState("");
  const navigate = useNavigate();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin-users/");
      setUsers(data || []);
    } catch (e) {
      showToast("Ошибка загрузки списка пользователей", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const openStorage = (uid) => {
    navigate(`/files?owner=${uid}`);
  };

  const toggleAdmin = async (user) => {
    // set _pending_admin on user to indicate in-flight
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, _pending_admin: true } : u));
    try {
      const res = await apiFetch(`/api/admin-users/${user.id}/set_admin/`, { method: "POST", body: { set_admin: !user.is_staff }});
      // Backend ideally returns updated user. If so, use it:
      if (res && res.id) {
        setUsers(prev => prev.map(u => u.id === res.id ? { ...u, is_staff: !!res.is_staff, _pending_admin: false } : u));
      } else {
        // fallback - toggle locally after success
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_staff: !u.is_staff, _pending_admin: false } : u));
      }
      showToast(!user.is_staff ? "Пользователь назначен администратором" : "Права администратора отозваны", { type: "success" });
    } catch (e) {
      showToast("Ошибка изменения прав", { type: "error" });
      // revert pending mark
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, _pending_admin: false } : u));
      await loadUsers();
    }
  };

  const toggleActive = async (user) => {
    try {
      await apiFetch(`/api/admin-users/${user.id}/toggle_active/`, { method: "POST" });
      showToast(user.is_active ? "Пользователь заблокирован" : "Пользователь разблокирован", { type: "success" });
      await loadUsers();
    } catch (e) { showToast("Ошибка изменения статуса", { type: "error" }); }
  };

  const handleSetQuotaStart = (user) => {
    setEditingQuotaFor(user.id);
    setQuotaInput(user.quota != null ? String(user.quota) : "");
  };

  const handleSetQuotaCancel = () => {
    setEditingQuotaFor(null);
    setQuotaInput("");
  };

  const handleSetQuotaSave = async (user) => {
    const bytes = parseSizeToBytes(quotaInput);
    if (bytes === null) return showToast("Некорректный размер (пример: 15GB, 500MB)", { type: "error" });
    try {
      await apiFetch(`/api/admin-users/${user.id}/set_quota/`, { method: "POST", body: { quota: bytes }});
      showToast("Квота обновлена", { type: "success" });
      setEditingQuotaFor(null);
      setQuotaInput("");
      await loadUsers();
    } catch (e) { showToast("Ошибка установки квоты", { type: "error" }); }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Удалить пользователя ${user.username}? (Будут удалены все его данные)`)) return;
    try {
      await apiFetch(`/api/admin-users/${user.id}/`, { method: "DELETE", body: { purge: true }});
      showToast("Пользователь удалён", { type: "success" });
      await loadUsers();
    } catch (e) { showToast("Ошибка удаления пользователя", { type: "error" }); }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="card p-4">
        <h2 className="text-xl font-semibold mb-4">Панель администратора — Пользователи</h2>

        {loading ? <div>Загрузка...</div> : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse"}}>
              <thead>
                <tr style={{textAlign:"left", borderBottom:"1px solid #e5e7eb"}}>
                  <th style={{padding:8}}>Логин</th>
                  <th style={{padding:8}}>ФИО</th>
                  <th style={{padding:8}}>Квота</th>
                  <th style={{padding:8}}>Занято</th>
                  <th style={{padding:8}}>Файлов</th>
                  <th style={{padding:8}}>Статус</th>
                  <th style={{padding:8}}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                    <td style={{padding:8}}>{u.username}</td>
                    <td style={{padding:8}}>{u.full_name || "-"}</td>
                    <td style={{padding:8}}>
                      {editingQuotaFor === u.id ? (
                        <div style={{display:"flex", gap:8}}>
                          <input value={quotaInput} onChange={(e)=>setQuotaInput(e.target.value)} placeholder="15GB" className="border p-1 rounded" />
                          <button className="btn btn-primary" onClick={()=>handleSetQuotaSave(u)}>Сохранить</button>
                          <button className="btn" onClick={handleSetQuotaCancel}>Отмена</button>
                        </div>
                      ) : (
                        <div style={{display:"flex", gap:8, alignItems:"center"}}>
                          <div>{u.quota != null ? formatBytes(u.quota) : "не установлено"}</div>
                          <button className="btn" onClick={()=>handleSetQuotaStart(u)}>Изменить</button>
                        </div>
                      )}
                    </td>
                    <td style={{padding:8}}>{u.files_size != null ? formatBytes(u.files_size) : "0 B"}</td>
                    <td style={{padding:8}}>{u.files_count ?? 0}</td>
                    <td style={{padding:8}}>{u.is_active ? "Активен" : "Заблокирован"}</td>
                    <td style={{padding:8, display:"flex", gap:6, flexWrap:"wrap"}}>
                      <button className="btn btn-primary" onClick={()=>openStorage(u.id)}>Открыть хранилище</button>
                      <button className="btn" onClick={()=>toggleAdmin(u)}>{u._pending_admin ? "..." : (u.is_staff ? "Отозвать админ" : "Назначить админ")}</button>
                      <button className="btn" onClick={()=>toggleActive(u)}>{u.is_active ? "Блокировать" : "Разблокировать"}</button>
                      <button className="btn btn-danger" onClick={()=>handleDeleteUser(u)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
