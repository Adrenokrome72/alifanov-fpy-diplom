// frontend/src/components/Register.jsx
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { register } from "../features/authSlice";
import { useNavigate } from "react-router-dom";
import { showToast } from "../utils/toast";

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function formatFriendlyError(err) {
    if (!err) return "Ошибка";
    if (err.data && typeof err.data === "object") {
      if (err.data.detail) return String(err.data.detail);
      const keys = Object.keys(err.data);
      if (keys.length) {
        const parts = [];
        for (const k of keys) {
          const v = err.data[k];
          if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
          else parts.push(`${k}: ${String(v)}`);
        }
        return parts.join("; ");
      }
    }
    if (err.message) return String(err.message);
    return "Ошибка";
  }

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await dispatch(register({ username, full_name, email, password })).unwrap();
      showToast("Регистрация успешна", { type: "success" });
      navigate("/login");
    } catch (err) {
      const friendly = formatFriendlyError(err);
      showToast(friendly, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="bg-white shadow rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Регистрация</h2>
        <form onSubmit={handle} className="flex flex-col gap-3">
          <input className="border p-2 rounded" value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Логин" />
          <input className="border p-2 rounded" value={full_name} onChange={(e)=>setFullName(e.target.value)} placeholder="ФИО" />
          <input className="border p-2 rounded" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" />
          <input type="password" className="border p-2 rounded" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Пароль" />
          <button disabled={loading} className="bg-sky-600 text-white p-2 rounded">{ loading ? "Регистрация..." : "Зарегистрироваться" }</button>
        </form>
      </div>
    </div>
  );
}
