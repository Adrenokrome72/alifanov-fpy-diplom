import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../features/authSlice';

export default function Login(){
  const dispatch = useDispatch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handle = async (e) => {
    e.preventDefault();
    try{
      await dispatch(login({ username, password })).unwrap();
      window.location.href = '/files';
    }catch(err){ setError(err); }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-xl mb-4">Login</h2>
      {error && <div className="text-red-500">Login failed</div>}
      <form onSubmit={handle} className="flex flex-col gap-2 max-w-md">
        <input className="border p-2" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" />
        <input type="password" className="border p-2" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
        <button className="bg-blue-600 text-white p-2 rounded" type="submit">Login</button>
      </form>
    </div>
  );
}