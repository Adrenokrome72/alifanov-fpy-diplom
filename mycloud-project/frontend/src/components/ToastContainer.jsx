// frontend/src/components/ToastContainer.jsx
import React, { useEffect, useState } from "react";

function Toast({ id, message, type }) {
  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}

export default function ToastContainer() {
  const [list, setList] = useState([]);

  useEffect(() => {
    function onToast(e) {
      const { message, type = "info", timeout = 5000 } = e.detail || {};
      const id = Date.now() + Math.random();
      setList((s) => [...s, { id, message, type }]);
      setTimeout(() => {
        setList((s) => s.filter((t) => t.id !== id));
      }, timeout);
    }
    window.addEventListener("mycloud:toast", onToast);
    return () => window.removeEventListener("mycloud:toast", onToast);
  }, []);

  return (
    <div className="toast-wrap" style={{
      position: "fixed",
      right: 20,
      top: 20,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      maxWidth: 360
    }}>
      {list.map(t => <Toast key={t.id} {...t} />)}
      <style>{`
        .toast { padding:10px 14px; border-radius:8px; color:white; box-shadow:0 6px 18px rgba(2,6,23,0.08); }
        .toast-info { background:#0ea5e9; }
        .toast-success { background:#10b981; }
        .toast-error { background:#ef4444; }
      `}</style>
    </div>
  );
}
