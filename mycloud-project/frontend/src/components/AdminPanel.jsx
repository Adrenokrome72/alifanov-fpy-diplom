import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../api";
import { showToast } from "../utils/toast";
import formatBytes from "../utils/formatBytes";

export default function AdminPanel() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [refreshFlag, setRefreshFlag] = useState(0);

  const toast = (msg, opts = {}) => {
    try { showToast && showToast(msg, opts); } catch (e) { console.log(msg); }
  };

  const getUid = (u) => u?.id ?? u?.pk ?? u?.user_id ?? u?.uid ?? u?.username;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingUsers(true);
      try {
        const res = await apiFetch(`/api/admin-users/`);
        const list = Array.isArray(res) ? res : (res.results || res.users || []);
        if (mounted) setUsers(list || []);
      } catch (e) {
        console.error("AdminPanel: failed to load users", e);
        toast("Не удалось загрузить список пользователей", { type: "error" });
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [refreshFlag]);

  const toggleBlock = async (user, isActive) => {
    const uid = getUid(user);
    if (!uid) return toast("Не удалось определить пользователя", { type: "error" });
    try {
      try {
        await apiFetch(`/api/admin-users/${uid}/toggle_active/`, { method: "POST", body: { is_active: !!isActive } });
      } catch (e) {
        await apiFetch(`/api/admin-users/${uid}/`, { method: "PATCH", body: { is_active: !!isActive } });
      }
      toast(isActive ? "Пользователь активирован" : "Пользователь деактивирован", { type: "success" });
      setRefreshFlag(f => f + 1);
    } catch (err) {
      console.error("toggleBlock error", err);
      toast("Не удалось изменить статус пользователя", { type: "error" });
    }
  };

  const toggleAdmin = async (user, isAdmin) => {
    const uid = getUid(user);
    if (!uid) return toast("Не удалось определить пользователя", { type: "error" });
    try {
      try {
        await apiFetch(`/api/admin-users/${uid}/set_admin/`, { method: "POST", body: { is_staff: !!isAdmin } });
      } catch (e) {
        await apiFetch(`/api/admin-users/${uid}/`, { method: "PATCH", body: { is_staff: !!isAdmin, is_admin: !!isAdmin } });
      }
      toast(isAdmin ? "Пользователь получил права администратора" : "Права администратора сняты", { type: "success" });
      setRefreshFlag(f => f + 1);
    } catch (err) {
      console.error("toggleAdmin error", err);
      toast("Не удалось изменить права администратора", { type: "error" });
    }
  };

  const deleteUser = async (user) => {
    const uid = getUid(user);
    if (!uid) return toast("Не удалось определить пользователя", { type: "error" });

    // Check if this is the last admin user
    const isAdmin = !!user.is_admin || !!user.isAdmin || !!user.admin || !!user.is_staff;
    if (isAdmin) {
      const adminCount = users.filter(u => !!u.is_admin || !!u.isAdmin || !!u.admin || !!u.is_staff).length;
      if (adminCount <= 1) {
        toast("Невозможно удалить единственного администратора системы", { type: "error" });
        return;
      }
    }

    if (!window.confirm(`Удалить пользователя ${user.username || uid}? Это действие необратимо.`)) return;
    try {
      const purge = window.confirm("Удалить полностью с очисткой данных (purge)? OK - да, Cancel - только аккаунт.");
      const query = purge ? "?purge=true" : "";
      await apiFetch(`/api/admin-users/${uid}/${query}`, { method: "DELETE" });
      toast("Пользователь удалён", { type: "success" });
      setSelectedUser(null);
      setRefreshFlag(f => f + 1);
    } catch (err) {
      console.error("deleteUser error", err);
      toast("Не удалось удалить пользователя", { type: "error" });
    }
  };

  const viewStorage = (user) => {
    const uid = getUid(user);
    if (!uid) return toast("Не удалось открыть хранилище: неизвестный пользователь", { type: "error" });
    navigate(`/admin/storage/${encodeURIComponent(uid)}`, { state: { user } });
  };

  return (
    <div className="container" style={{ paddingTop: 18 }}>
      <div className="card">
        <div className="card-title" style={{display: "flex", alignItems: "center", gap: 12}}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Админ — пользователи</div>
          <div style={{ marginLeft: "auto", color: "#65748b" }}>{loadingUsers ? "Загрузка..." : `${users.length} пользователей`}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, marginTop: 12 }}>
          <aside className="card" style={{ padding: 12, maxHeight: "70vh", overflow: "auto" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Пользователи</div>

            {loadingUsers ? (
              <div className="muted">Загрузка...</div>
            ) : users.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {users.map(u => {
                  const uid = getUid(u);
                  const isBlocked = !!u.is_blocked || !!u.blocked || u.is_active === false;
                  const isAdmin = !!u.is_admin || !!u.isAdmin || !!u.admin || !!u.is_staff;
                  return (
                    <div
                      key={uid}
                      className={`folder-item ${selectedUser && getUid(selectedUser) === uid ? "active" : ""}`}
                      onClick={() => setSelectedUser(u)}
                      role="button"
                      tabIndex={0}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth:0 }}>
                        <div className="icon">👤</div>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {u.username ?? u.email ?? `#${uid}`}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div className="muted" style={{ fontSize: 12 }}>{u.storage_used ? (formatBytes ? formatBytes(u.storage_used) : u.storage_used) : ""}</div>
                        {isAdmin && <div className="muted" title="Администратор" style={{ fontSize: 12, paddingLeft: 6 }}>★</div>}
                        {isBlocked && <div className="muted" title="Заблокирован" style={{ fontSize: 12, paddingLeft: 6 }}>⛔</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="muted">Пользователи не найдены</div>
            )}
          </aside>

          <main className="main">
            <div className="card" style={{ minHeight: 340 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{selectedUser ? (selectedUser.username ?? selectedUser.email ?? "Пользователь") : "Выберите пользователя"}</div>
                <div className="muted">{selectedUser ? `id: ${getUid(selectedUser)}` : ""}</div>
              </div>

              <div style={{ marginTop: 14 }}>
                {selectedUser && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => selectedUser && viewStorage(selectedUser)}
                  >
                    Просмотреть хранилище
                  </button>

                  <button
                    className="btn btn-ghost"
                    onClick={() => selectedUser && toggleBlock(selectedUser, false)}
                  >
                    Разблокировать
                  </button>

                  <button
                    className="btn btn-ghost"
                    onClick={() => selectedUser && toggleBlock(selectedUser, true)}
                  >
                    Заблокировать
                  </button>

                  <button
                    className="btn btn-ghost"
                    onClick={() => selectedUser && toggleAdmin(selectedUser, true)}
                  >
                    Назначить администратора
                  </button>

                  <button
                    className="btn btn-ghost"
                    onClick={() => selectedUser && toggleAdmin(selectedUser, false)}
                  >
                    Убрать администратора
                  </button>

                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      // Create modal for quota editing
                      const modal = document.createElement('div');
                      modal.style.cssText = `
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
                        z-index: 10000;
                      `;
                      modal.innerHTML = `
                        <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
                          <h3 style="margin: 0 0 16px 0; font-size: 18px;">Изменить лимит места</h3>
                          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                            <input type="number" id="quotaValue" placeholder="Размер" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" min="0" />
                            <select id="quotaUnit" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                              <option value="MB">MB</option>
                              <option value="GB">GB</option>
                              <option value="TB">TB</option>
                            </select>
                          </div>
                          <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button id="cancelBtn" class="btn">Отмена</button>
                            <button id="saveBtn" class="btn btn-primary">Сохранить</button>
                          </div>
                        </div>
                      `;
                      document.body.appendChild(modal);

                      const quotaValueInput = modal.querySelector('#quotaValue');
                      const quotaUnitSelect = modal.querySelector('#quotaUnit');
                      const cancelBtn = modal.querySelector('#cancelBtn');
                      const saveBtn = modal.querySelector('#saveBtn');

                      if (selectedUser.quota) {
                        const quotaInMB = selectedUser.quota / (1024 * 1024);
                        if (quotaInMB >= 1024 * 1024) {
                          quotaValueInput.value = (quotaInMB / (1024 * 1024)).toFixed(2);
                          quotaUnitSelect.value = 'TB';
                        } else if (quotaInMB >= 1024) {
                          quotaValueInput.value = (quotaInMB / 1024).toFixed(2);
                          quotaUnitSelect.value = 'GB';
                        } else {
                          quotaValueInput.value = quotaInMB.toFixed(2);
                          quotaUnitSelect.value = 'MB';
                        }
                      }

                      cancelBtn.onclick = () => document.body.removeChild(modal);
                      saveBtn.onclick = async () => {
                        const value = parseFloat(quotaValueInput.value);
                        const unit = quotaUnitSelect.value;
                        if (isNaN(value) || value < 0) {
                          toast("Некорректное значение", { type: "error" });
                          return;
                        }
                        let quotaBytes = value;
                        if (unit === 'GB') quotaBytes *= 1024 * 1024 * 1024;
                        else if (unit === 'TB') quotaBytes *= 1024 * 1024 * 1024 * 1024;
                        else quotaBytes *= 1024 * 1024; // MB

                        try {
                          await apiFetch(`/api/admin-users/${getUid(selectedUser)}/set_quota/`, {
                            method: "POST",
                            body: { quota: Math.floor(quotaBytes) }
                          });
                          toast("Лимит обновлён", { type: "success" });
                          setRefreshFlag(f => f + 1);
                          // Update the selected user data immediately
                          setSelectedUser(prev => prev ? { ...prev, quota: Math.floor(quotaBytes) } : prev);
                          document.body.removeChild(modal);
                        } catch (err) {
                          console.error("setQuota error", err);
                          toast("Не удалось обновить лимит", { type: "error" });
                        }
                      };
                    }}
                  >
                    Изменить лимит
                  </button>

                  <button
                    className="btn btn-danger"
                    onClick={() => selectedUser && deleteUser(selectedUser)}
                  >
                    Удалить
                  </button>
                </div>
                )}

                <div style={{ fontWeight: 700, marginBottom: 8 }}>Информация</div>
                <div className="card p-2" style={{ marginBottom: 12 }}>
                  {selectedUser ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div><b>Логин:</b> {selectedUser.username ?? "-"}</div>
                        <div><b>Email:</b> {selectedUser.email ?? "-"}</div>
                        <div><b>Статус:</b> {selectedUser.is_active === false ? "Неактивен" : (selectedUser.is_active ? "Активен" : "-")}</div>
                        <div><b>Администратор:</b> {selectedUser.is_admin || selectedUser.is_staff ? "Да" : "Нет"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Место</div>
                        <div style={{marginTop:6}}>
                          <div style={{height:12, background:"#f1f5f9", borderRadius:8, overflow:"hidden"}}>
                            <div style={{
                              height:"100%",
                              width: `${Math.min(100, Math.max(0, Math.round((selectedUser.files_size / (selectedUser.quota || 10*1024*1024*1024)) * 100))) }%`,
                              background: `linear-gradient(90deg,#06b6d4,#10b981)`
                            }} />
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            { `${formatBytes(selectedUser.files_size || 0)} из ${formatBytes(selectedUser.quota || 10*1024*1024*1024)} (${Math.round((selectedUser.files_size / (selectedUser.quota || 10*1024*1024*1024)) * 100)}% занято)` }
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="muted">Выберите пользователя в левой колонке</div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
