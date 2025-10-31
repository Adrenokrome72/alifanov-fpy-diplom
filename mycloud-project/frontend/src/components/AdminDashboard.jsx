import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function AdminDashboard(){
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    apiFetch('/api/admin-users/').then(d=>{ setUsers(d); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  if(loading) return <div className="p-4">Loading...</div>;
  return (
    <div className="container mx-auto p-4">
      <h2 className="text-xl mb-4">Admin Dashboard</h2>
      <table className="w-full table-auto border-collapse border">
        <thead><tr className="bg-gray-100"><th className="p-2">Username</th><th>Email</th><th>Files</th><th>Size</th><th>Quota</th><th>Admin</th></tr></thead>
        <tbody>
          {users.map(u=> (
            <tr key={u.id} className="border-t"><td className="p-2">{u.username}</td><td>{u.email}</td><td>{u.files_count}</td><td>{u.files_size}</td><td>{u.quota}</td><td>{String(u.is_staff)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}