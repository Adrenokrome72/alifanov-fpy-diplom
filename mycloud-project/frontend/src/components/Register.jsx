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
    <div className="container" style={{minHeight:"70vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
      <div className="card" style={{position:"relative", zIndex:9999, maxWidth:520, width:"100%", padding:24}}>
        <div className="card-title">
          <div style={{fontSize:20, fontWeight:700}}>Регистрация</div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (typeof handleRegister === "function") return handleRegister(e);
            if (typeof submitRegister === "function") return submitRegister(e);
            if (typeof onRegister === "function") return onRegister(e);
            return null;
          }}
          style={{display:"flex", flexDirection:"column", gap:12, marginTop:8}}
        >
          <div>
            <label className="label">Имя</label>
            {(() => {
              const v = (typeof name !== "undefined" ? name : undefined);
              const setter = (typeof setName === "function" ? setName : null);
              const common = { className: "input", placeholder: "Ваше имя", style: { pointerEvents: "auto" } };

              if (setter) {
                return <input {...common} value={typeof v !== "undefined" && v !== null ? v : ""} onChange={(ev) => setter(ev.target.value)} />;
              }
              return <input {...common} defaultValue={typeof v !== "undefined" && v !== null ? v : ""} />;
            })()}
          </div>

          <div>
            <label className="label">Email</label>
            {(() => {
              const v = (typeof email !== "undefined" ? email : undefined);
              const setter = (typeof setEmail === "function" ? setEmail : null);
              const common = { className: "input", placeholder: "you@example.com", style: { pointerEvents: "auto" } };

              if (setter) {
                return <input {...common} value={typeof v !== "undefined" && v !== null ? v : ""} onChange={(ev) => setter(ev.target.value)} />;
              }
              return <input {...common} defaultValue={typeof v !== "undefined" && v !== null ? v : ""} />;
            })()}
          </div>

          <div>
            <label className="label">Пароль</label>
            {(() => {
              const v = (typeof password !== "undefined" ? password : undefined);
              const setter = (typeof setPassword === "function" ? setPassword : null);
              const common = { className: "input", type: "password", placeholder: "Придумайте пароль", style: { pointerEvents: "auto" } };

              if (setter) {
                return <input {...common} value={typeof v !== "undefined" && v !== null ? v : ""} onChange={(ev) => setter(ev.target.value)} />;
              }
              return <input {...common} defaultValue={typeof v !== "undefined" && v !== null ? v : ""} />;
            })()}
          </div>

          <div style={{display:"flex", justifyContent:"flex-end", gap:8}}>
            <button className="btn btn-primary" type="submit">Зарегистрироваться</button>
          </div>
        </form>
      </div>
    </div>
  );
}
