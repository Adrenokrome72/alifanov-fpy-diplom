// frontend/src/components/NavBar.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../features/authSlice";
import formatBytes from "../utils/formatBytes";

/* DEFAULT_QUOTA can be kept in config */
const DEFAULT_QUOTA = 10 * 1024 * 1024 * 1024; // 10 GB

export default function NavBar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(s => s.auth.user);

  // local state for dynamic used_bytes (fallback when backend doesn't provide)
  const [localUsed, setLocalUsed] = useState(user?.profile?.used_bytes ?? 0);

  useEffect(() => {
    // keep localUsed in sync with Redux user profile updates
    setLocalUsed(user?.profile?.used_bytes ?? localUsed);
  }, [user?.profile?.used_bytes]);

  useEffect(() => {
    function onUsage(e) {
      const used = Number(e?.detail?.used || 0);
      setLocalUsed(used);
      // also dispatch custom event to inform others if needed
      // window.dispatchEvent(new CustomEvent('mycloud:user:usage_updated', { detail: { used } }));
    }
    window.addEventListener("mycloud:usage", onUsage);
    return () => window.removeEventListener("mycloud:usage", onUsage);
  }, []);

  const firstName = (() => {
    const full = (user?.full_name || user?.profile?.full_name || "").trim();
    if (full) {
      const parts = full.split(/\s+/);
      if (parts.length) return parts[0];
    }
    if (user?.username) return user.username;
    if (user?.email) return user.email?.split("@")[0] ?? "User";
    return "User";
  })();

  async function doLogout() {
    try {
      await dispatch(logout()).unwrap();
    } catch (err) {
      console.error(err);
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
    <header className="header">
      <div className="header-inner container" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/" className="brand">MyCloud</Link>
          <nav className="nav" aria-label="Main navigation" style={{display:"flex", gap:12}}>
            <Link to="/" className="link">Home</Link>
            <Link to="/files" className="link">Files</Link>
            {user && user.is_staff && <Link to="/admin" className="link">Admin</Link>}
          </nav>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {user ? (
            <>
              <div style={{textAlign:"right"}}>
                <div className="text-sm">Привет, <strong>{firstName}</strong>!</div>
                <div className="text-xs text-gray-500">
                  {formatBytes(remaining)} свободно ({percentFree}%)
                </div>
              </div>
              <button className="btn" onClick={doLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn">Login</Link>
              <Link to="/register" className="btn btn-primary">Register</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
