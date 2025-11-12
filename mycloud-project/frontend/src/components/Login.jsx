// frontend/src/components/Login.jsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../features/authSlice';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../utils/toast';

export default function Login(){
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  function formatFriendlyError(err) {
    // err may be Error with .status and .data
    if (!err) return 'Ошибка';
    if (err.status === 400 || err.status === 401) {
      return 'Неправильный логин или пароль';
    }
    // if err.data contains field errors, take first message
    if (err.data && typeof err.data === 'object') {
      if (err.data.detail) return String(err.data.detail);
      const keys = Object.keys(err.data);
      if (keys.length) {
        const first = err.data[keys[0]];
        if (Array.isArray(first)) return String(first[0]);
        return String(first);
      }
    }
    if (err.message) return String(err.message);
    return 'Ошибка';
  }

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try{
      await dispatch(login({ username, password })).unwrap();
      showToast('Вход выполнен', { type: 'success' });
      navigate('/files');
    }catch(err){
      const friendly = formatFriendlyError(err);
      showToast(friendly, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center"}}>
      {/* повысим z-index карточки, чтобы она была над возможными оверлеями */}
      <div className="card" style={{position: "relative", zIndex: 9999, maxWidth: 420, width: "100%", padding: 24}}>
        <div className="card-title">
          <div style={{fontSize: 20, fontWeight: 700}}>Вход в MyCloud</div>
        </div>

        <form onSubmit={handle} style={{display: "flex", flexDirection: "column", gap: 12, marginTop: 8}}>
          <div>
          <label className="label">Логин</label>
          <input
            className="input"
            placeholder="Логин"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ pointerEvents: "auto" }}
          />
        </div>

          <div>
            <label className="label">Пароль</label>

            {(() => {
              const pv = (typeof password !== "undefined" ? password : undefined);
              const psetter = (typeof setPassword === "function" ? setPassword : null);
              const props = { className: "input", placeholder: "Введите пароль", autoComplete: "current-password", style: { pointerEvents: "auto" } };

              if (psetter) {
                return (
                  <input
                    {...props}
                    type="password"
                    value={typeof pv !== "undefined" && pv !== null ? pv : ""}
                    onChange={(ev) => psetter(ev.target.value)}
                  />
                );
              }

              return (
                <input
                  {...props}
                  type="password"
                  defaultValue={typeof pv !== "undefined" && pv !== null ? pv : ""}
                />
              );
            })()}
          </div>

          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <button className="btn btn-primary" type="submit">Войти</button>

            <a
              className="link"
              href="/register"
              onClick={(ev) => {
                ev.preventDefault();
                if (typeof navigate === "function") return navigate("/register");
                if (typeof history !== "undefined" && typeof history.push === "function") return history.push("/register");
                return null;
              }}
            >
              Регистрация
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
