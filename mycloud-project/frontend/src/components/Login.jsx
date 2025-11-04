// frontend/src/components/Login.jsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../features/authSlice';
import { useNavigate } from 'react-router-dom';

export default function Login(){
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try{
      await dispatch(login({ username, password })).unwrap();
      navigate('/files');
    }catch(err){
      setError(err.data || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="bg-white shadow rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Login</h2>
        {error && <div className="mb-3 text-red-600">{String(error)}</div>}
        <form onSubmit={handle} className="flex flex-col gap-3">
          <input className="border p-2 rounded" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" />
          <input type="password" className="border p-2 rounded" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
          <button disabled={loading} className="bg-sky-600 text-white p-2 rounded">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
