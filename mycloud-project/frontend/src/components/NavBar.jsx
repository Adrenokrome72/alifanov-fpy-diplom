import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout, fetchCurrentUser } from "../features/authSlice";
import formatBytes from "../utils/formatBytes";
import { showToast } from "../utils/toast";

const DEFAULT_QUOTA = 10 * 1024 * 1024 * 1024;

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

  useEffect(() => {
    dispatch(fetchCurrentUser()).catch(()=>{ /* ignore */});
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

  const hasProfile = Boolean(user && (user.profile || user.full_name || user.username));
  const quotaRaw = hasProfile ? (user?.profile?.quota ?? null) : null;
  const quota = quotaRaw != null ? Number(quotaRaw) : DEFAULT_QUOTA;
  const used = hasProfile ? Number(localUsed || 0) : 0;
  const remaining = Math.max(0, quota - used);
  const percentFree = quota ? Math.round((remaining / quota) * 100) : 0;

  return (
    <header className="header bg-slate-50 shadow-sm">
      <div className="header-inner container mx-auto p-3" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/" className="brand font-bold text-lg">Cloud</Link>
          <nav className="nav" aria-label="Main navigation" style={{display:"flex", gap:12}}>
            <Link to="/" className="link">Главная</Link>
            <Link to="/files" className="link">Файлы</Link>
            {user && user.is_staff && <Link to="/admin" className="link">Панель администратора</Link>}
          </nav>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {user ? (
            <>
              <div style={{textAlign:"right"}}>
                <div className="text-sm">Привет, <strong>{firstName}</strong>!</div>
                { hasProfile && (
                  <div style={{marginLeft:16, display:"flex", alignItems:"center", gap:8}}>
                    <div style={{height:12, width:120, background:"#f1f5f9", borderRadius:6, overflow:"hidden"}}>
                      <div style={{
                        height:"100%",
                        width: `${Math.min(100, Math.max(0, Math.round(((quota - remaining) / quota) * 100))) }%`,
                        background: `linear-gradient(90deg,#06b6d4,#10b981)`
                      }} />
                    </div>
                    <div className="text-xs text-gray-500">
                      { `${formatBytes(remaining)} из ${formatBytes(quota)}` }
                    </div>
                  </div>
                )}
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
