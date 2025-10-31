import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { register } from '../features/authSlice';

export default function Register(){
  const dispatch = useDispatch();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [full_name, setFullName] = useState('');
  const [msg, setMsg] = useState(null);

  const handle = async (e) => {
    e.preventDefault();
    try{
      await dispatch(register({ username, email, password, full_name })).unwrap();
      setMsg('Registered. Please login.');
    }catch(err){ setMsg('Error: ' + (err.data || err.message)); }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-xl mb-4">Register</h2>
      {msg && <div className="mb-2">{msg}</div>}
      <form onSubmit={handle} className="flex flex-col gap-2 max-w-md">
        <input className="border p-2" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" />
        <input className="border p-2" value={full_name} onChange={e=>setFullName(e.target.value)} placeholder="Full name" />
        <input className="border p-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
        <input type="password" className="border p-2" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
        <button className="bg-green-600 text-white p-2 rounded" type="submit">Register</button>
      </form>
    </div>
  );
}