// frontend/src/components/NavBar.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout, fetchCurrentUser } from "../features/authSlice";
import formatBytes from "../utils/formatBytes";
import { showToast } from "../utils/toast";

/* DEFAULT_QUOTA can be kept in config */
const DEFAULT_QUOTA = 10 * 1024 * 1024 * 1024; // 10 GB

export default function NavBar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(s => s.auth.user);

  const [localUsed, setLocalUsed] = useState(user?.profile?.used_bytes ?? 0);

  useEffect(() => {
    setLocalUsed(user?.profile?.used_bytes ?? 0);
  }, [user?.profile?.used_bytes]);

  useEffect(() => {
    function onUsage(e) {
      const used = Number(e?.detail?.used || 0);
      setLocalUsed(used);
    }
    window.addEventListener("mycloud:usage", onUsage);
    return () => window.removeEventListener("mycloud:usage", onUsage);
  }, []);

  // Try to ensure we have fresh user data on mount
  useEffect(() => {
    dispatch(fetchCurrentUser()).catch(()=>{ /* ignore */});
    // expose convenience function used by some components
    window.fetchCurrentUser = async () => {
      try {
        const res = await dispatch(fetchCurrentUser()).unwrap();
        return res;
      } catch (e) { return null; }
    };
  }, [dispatch]);

  const firstName = (() => {
    const full = (user?.full_name || user?.profile?.full_name || "").trim();
    if (full) {
      const parts = full.split(/\s+/);
      if (parts.length) return parts[0];
    }
    if (user?.username) return user.username;
    if (user?.email) return user.email?.split("@")[0] ?? "Пользователь";
    return "Пользователь";
  })();

  async function doLogout() {
    try {
      await dispatch(logout()).unwrap();
      showToast('Вы вышли', { type: 'success' });
    } catch (err) {
      showToast('Ошибка при выходе', { type: 'error' });
    } finally {
      navigate("/login");
    }
  }

  const quotaRaw = user?.profile?.quota;
  const quota = quotaRaw != null ? Number(quotaRaw) : DEFAULT_QUOTA;
  const used = Number(localUsed || 0);
  const remaining = Math.max(0, quota - used);
  const percentFree = quota ? Math.round((remaining / quota) * 100) : 0;

  return (
    <header className="header bg-slate-50 shadow-sm">
      <div className="header-inner container mx-auto p-3" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/" className="brand font-bold text-lg">MyCloud</Link>
          <nav className="nav" aria-label="Main navigation" style={{display:"flex", gap:12}}>
            <Link to="/" className="link">Главная</Link>
            <Link to="/files" className="link">Файлы</Link>
            {user && user.is_staff && <Link to="/admin" className="link">Админ</Link>}
          </nav>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {user ? (
            <>
              <div style={{textAlign:"right"}}>
                <div className="text-sm">Привет, <strong>{firstName}</strong>!</div>
                <div className="text-xs text-gray-500">
                  Осталось: {formatBytes(remaining)} ({percentFree}%)
                </div>
              </div>
              <button className="btn bg-white border rounded px-3 py-1" onClick={doLogout}>Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn border rounded px-3 py-1">Войти</Link>
              <Link to="/register" className="btn btn-primary px-3 py-1 bg-sky-600 text-white rounded">Регистрация</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
