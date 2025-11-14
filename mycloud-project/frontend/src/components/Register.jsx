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
  const [login, setLogin] = useState("");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await dispatch(register({ username: login || username, full_name, email, password })).unwrap();
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
    <div className="container" style={{minHeight:"70vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
      <div className="card" style={{position:"relative", zIndex:9999, maxWidth:520, width:"100%", padding:24}}>
        <div className="card-title">
          <div style={{fontSize:20, fontWeight:700}}>Регистрация</div>
        </div>

        <form onSubmit={handleSubmit} style={{display:"flex", flexDirection:"column", gap:12, marginTop:8}}>
          <div>
            <label className="label">Логин</label>
            <input
              className="input"
              placeholder="Ваш логин"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Ваши Имя и Фамилия</label>
            <input
              className="input"
              placeholder="Ваше полное имя и фамилия"
              value={full_name}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Пароль</label>
            <input
              className="input"
              type="password"
              placeholder="Придумайте пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{display:"flex", justifyContent:"flex-end", gap:8}}>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


