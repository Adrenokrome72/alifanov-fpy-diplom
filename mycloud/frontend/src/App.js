// frontend/src/App.js
import React, { useEffect, useState } from 'react';
import './styles.css'; // импорт стилей
import Cookies from 'js-cookie';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';

import api, { setCSRFCookieHeader } from './api/axios'; // единый axios инстанс
import AdminPanel from './components/AdminPanel';
import CloudExplorer from './components/CloudExplorer';

/* Инициализация CSRF: запрос, который установит csrftoken cookie в браузере */
async function initCsrf() {
  try {
    await api.get('/users/csrf/'); // view ensure_csrf_cookie
    setCSRFCookieHeader();
  } catch (e) {
    // non-fatal — логируем в консоль для отладки
    // console.warn('initCsrf failed', e);
  }
}

/* ----------------------------- UI Components ----------------------------- */

function Nav({ user, onLogout }) {
  return (
    <nav style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
      <Link to="/" style={{ marginRight: 10 }}>Home</Link>
      {!user && <Link to="/register" style={{ marginRight: 10 }}>Register</Link>}
      {!user && <Link to="/login" style={{ marginRight: 10 }}>Login</Link>}
      {user && <Link to="/dashboard" style={{ marginRight: 10 }}>Cloud</Link>}
      {user && <Link to="/admin" style={{ marginRight: 10 }}>Admin</Link>}
      {user && (
        <button style={{ marginLeft: 10 }} onClick={onLogout}>
          Logout
        </button>
      )}
      <span style={{ float: 'right' }}>{user ? `User: ${user}` : 'Not logged in'}</span>
    </nav>
  );
}

/* Home - простая страница */
function Home() {
  return (
    <div style={{ padding: 18 }}>
      <h2>My Cloud — Demo Frontend</h2>
      <p>Используйте навигацию для регистрации, входа и управления файлами.</p>
    </div>
  );
}

/* Register Component */
function Register() {
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      username: e.target.username.value,
      email: e.target.email.value,
      password: e.target.password.value,
      first_name: e.target.first_name.value,
      last_name: e.target.last_name.value,
    };
    try {
      await initCsrf();
      const resp = await api.post('/users/register/', payload);
      setStatus({ ok: true, data: resp.data });
    } catch (err) {
      setStatus({ ok: false, error: err.response?.data || err.message });
    }
  };

  return (
    <div style={{ padding: 18 }}>
      <h3>Register</h3>
      <form onSubmit={handleSubmit}>
        <div><input name="username" placeholder="username" required /></div>
        <div><input name="email" placeholder="email" type="email" required /></div>
        <div><input name="password" placeholder="password" type="password" required /></div>
        <div><input name="first_name" placeholder="first name" /></div>
        <div><input name="last_name" placeholder="last name" /></div>
        <button type="submit" style={{ marginTop: 8 }}>Register</button>
      </form>
      <pre style={{ marginTop: 12 }}>{status ? JSON.stringify(status, null, 2) : ''}</pre>
    </div>
  );
}

/* Login Component */
function Login({ onLogin }) {
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await initCsrf();
      const payload = {
        username: e.target.username.value,
        password: e.target.password.value,
      };
      const resp = await api.post('/users/login/', payload);
      setStatus({ ok: true, data: resp.data });
      onLogin(payload.username || '');
      navigate('/dashboard');
    } catch (err) {
      setStatus({ ok: false, error: err.response?.data || err.message });
    }
  };

  return (
    <div style={{ padding: 18 }}>
      <h3>Login</h3>
      <form onSubmit={handleSubmit}>
        <div><input name="username" placeholder="username" required /></div>
        <div><input name="password" placeholder="password" type="password" required /></div>
        <button type="submit" style={{ marginTop: 8 }}>Login</button>
      </form>
      <pre style={{ marginTop: 12 }}>{status ? JSON.stringify(status, null, 2) : ''}</pre>
    </div>
  );
}

/* A tiny legacy dashboard (kept for quick checks) */
function LegacyDashboard() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const loadFiles = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/storage/files/');
      setFiles(resp.data);
    } catch (err) {
      setMsg('Load failed: ' + (err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(); }, []);

  const onUploaded = (newFile) => {
    setFiles(prev => [newFile, ...prev]);
  };

  const makePublic = async (id) => {
    try {
      const resp = await api.post(`/storage/files/${id}/public-link/`);
      setMsg('Public link: ' + (resp.data.public_link || JSON.stringify(resp.data)));
    } catch (err) {
      setMsg('Public link failed: ' + (err.response?.data || err.message));
    }
  };

  return (
    <div style={{ padding: 18 }}>
      <h3>Legacy Dashboard</h3>
      <div style={{ marginBottom: 12 }}>
        <button onClick={loadFiles} disabled={loading}>Reload</button>
      </div>
      <div style={{ marginTop: 12 }}>{msg}</div>
      <ul style={{ marginTop: 12 }}>
        {files.map(f => (
          <li key={f.id} style={{ marginBottom: 8 }}>
            <a href={f.download_url} target="_blank" rel="noreferrer">{f.original_name}</a>
            {' '}({f.size || '—'} bytes){' '}
            <button onClick={() => makePublic(f.id)} style={{ marginLeft: 8 }}>Make public</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Main App */
export default function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // init CSRF early
  useEffect(() => {
    initCsrf();
  }, []);

  const logout = async () => {
    try {
      await initCsrf();
      await api.post('/users/logout/');
    } catch (e) {
      // ignore
    } finally {
      setUser(null);
      navigate('/');
    }
  };

  return (
    <div>
      <Nav user={user} onLogout={logout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />

        {/* Main file manager */}
        <Route path="/dashboard" element={<CloudExplorer />} />

        {/* Legacy simple dashboard kept for quick checks */}
        <Route path="/legacy" element={<LegacyDashboard />} />

        {/* Admin panel */}
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </div>
  );
}
