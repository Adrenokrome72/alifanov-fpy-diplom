// frontend/src/components/Register.jsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { register } from '../features/authSlice';
import { useNavigate } from 'react-router-dom';

export default function Register(){
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [full_name, setFullName] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try{
      await dispatch(register({ username, email, password, full_name })).unwrap();
      setMsg('Registered. Please login.');
      setTimeout(()=>navigate('/login'), 800);
    }catch(err){
      setMsg('Error: ' + (err.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="bg-white shadow rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Register</h2>
        {msg && <div className="mb-3 text-sm">{msg}</div>}
        <form onSubmit={handle} className="flex flex-col gap-3">
          <input className="border p-2 rounded" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" />
          <input className="border p-2 rounded" value={full_name} onChange={e=>setFullName(e.target.value)} placeholder="Full name" />
          <input className="border p-2 rounded" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
          <input type="password" className="border p-2 rounded" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
          <button disabled={loading} className="bg-green-600 text-white p-2 rounded">{loading ? 'Registering...' : 'Register'}</button>
        </form>
      </div>
    </div>
  );
}
