import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';


const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // для сессий и cookie
});

function setCSRFCookieHeader() {
  const token = Cookies.get('csrftoken');
  if (token) api.defaults.headers.common['X-CSRFToken'] = token;
}

/* Инициализация CSRF: запрос, который установит csrftoken cookie в браузере */
async function initCsrf() {
  try {
    await api.get('/users/csrf/');
    setCSRFCookieHeader();
  } catch (e) {
  }
}

/* ----------------------------- UI Components ----------------------------- */

function Nav({ user, onLogout }) {
  return (
    <nav style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
      <Link to="/" style={{ marginRight: 10 }}>Home</Link>
      {!user && <Link to="/register" style={{ marginRight: 10 }}>Register</Link>}
      {!user && <Link to="/login" style={{ marginRight: 10 }}>Login</Link>}
      {user && <Link to="/dashboard" style={{ marginRight: 10 }}>Dashboard</Link>}
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
      <p>Используйте навигацию для регистрации, входа и загрузки файлов.</p>
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
      setCSRFCookieHeader();
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
      setCSRFCookieHeader();
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

/* FileUpload component */
function FileUpload({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState(null);

  const submit = async (e) => {
    e && e.preventDefault();
    if (!file) return setStatus({ ok: false, error: 'No file selected' });
    try {
      await initCsrf();
      setCSRFCookieHeader();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('comment', comment || '');
      const resp = await api.post('/storage/files/upload/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStatus({ ok: true, data: resp.data });
      onUploaded && onUploaded(resp.data);
    } catch (err) {
      setStatus({ ok: false, error: err.response?.data || err.message });
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <form onSubmit={submit}>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <input placeholder="comment" value={comment} onChange={(e) => setComment(e.target.value)} />
        <button type="submit">Upload</button>
      </form>
      <pre>{status ? JSON.stringify(status, null, 2) : ''}</pre>
    </div>
  );
}

/* Dashboard */
function Dashboard() {
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
      <h3>Dashboard</h3>
      <FileUpload onUploaded={onUploaded} />
      <button onClick={loadFiles} disabled={loading} style={{ marginTop: 8 }}>Reload</button>
      <div style={{ marginTop: 12 }}>{msg}</div>
      <ul style={{ marginTop: 12 }}>
        {files.map(f => (
          <li key={f.id} style={{ marginBottom: 8 }}>
            <a href={f.download_url} target="_blank" rel="noreferrer">{f.original_name}</a>
            {' '}({f.size || '—'} bytes){' '}
            <button onClick={() => makePublic(f.id)} style={{ marginLeft: 8 }}>Make public</button>
            {f.public_link_token ? <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>token: {f.public_link_token}</div> : null}
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
    initCsrf().then(setCSRFCookieHeader);
  }, []);

  const logout = async () => {
    try {
      await initCsrf();
      setCSRFCookieHeader();
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
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}