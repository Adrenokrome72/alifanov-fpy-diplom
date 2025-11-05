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
    <div className="container mx-auto p-6 max-w-md">
      <div className="bg-white shadow rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Вход</h2>
        <form onSubmit={handle} className="flex flex-col gap-3">
          <input
            className="border p-2 rounded"
            value={username}
            onChange={e=>setUsername(e.target.value)}
            placeholder="Логин"
            autoComplete="username"
          />
          <input
            type="password"
            className="border p-2 rounded"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="Пароль"
            autoComplete="current-password"
          />
          <button disabled={loading} className="bg-sky-600 text-white p-2 rounded">
            {loading ? 'Вхожу...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
