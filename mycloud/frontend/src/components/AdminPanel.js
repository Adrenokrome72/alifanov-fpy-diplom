import React, { useEffect, useState } from 'react';
import api, { initCsrf, setCSRFCookieHeader } from '../api/axios';
import ConfirmModal from './ConfirmModal';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState({ open: false, user: null, action: '' });

  useEffect(() => {
    (async () => {
      try {
        await initCsrf();
        setCSRFCookieHeader();
      } catch (e) {
        console.warn('initCsrf failed', e);
      }
      await loadUsers();
    })();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setMsg('');
    try {
      const resp = await api.get('/users/');
      setUsers(Array.isArray(resp.data) ? resp.data : []);
    } catch (e) {
      console.error('loadUsers', e);
      setMsg('Failed to load users: ' + (e.response?.status || e.message));
    } finally {
      setLoading(false);
    }
  }

  function askAction(u, action) {
    setConfirm({ open: true, user: u, action });
  }

  async function performAction() {
    const u = confirm.user;
    const action = confirm.action;
    if (!u) return setConfirm({ open: false, user: null, action: '' });
    const id = u.id;
    try {
      setMsg('');
      await initCsrf();
      setCSRFCookieHeader();
      await api.post(`/users/${id}/manage/`, { action });
      if (action === 'delete') {
        setUsers(prev => prev.filter(x => x.id !== id));
      } else {
        await loadUsers();
      }
      setMsg('User updated');
    } catch (e) {
      console.error('performAction', e);
      setMsg('Error: ' + (e.response?.data?.detail || e.message));
    } finally {
      setConfirm({ open: false, user: null, action: '' });
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 style={{margin:0}}>Админ — пользователи</h3>
        <div className="small-muted">Всего: {users.length}</div>
      </div>

      <div style={{marginTop:12}}>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Admin</th>
              <th>Storage used/limit</th>
              <th>Blocked</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong><div className="small">{u.email}</div></td>
                <td className="small">{u.email}</td>
                <td>{u.is_staff ? 'Yes' : 'No'}</td>
                <td>{formatBytes(u.used_storage)} / {formatBytes(u.storage_limit)}</td>
                <td>{u.is_blocked ? <span style={{color:'#a00'}}>Yes</span> : 'No'}</td>
                <td>{u.can_upload ? 'U' : ''}{u.can_download ? 'D' : ''}{u.can_view ? 'V' : ''}</td>
                <td>
                  <button className="btn ghost" onClick={() => askAction(u, u.is_blocked ? 'unblock' : 'block')}>{u.is_blocked ? 'Unblock' : 'Block'}</button>
                  <button className="btn ghost" onClick={() => askAction(u, u.is_staff ? 'remove_admin' : 'set_admin')}>{u.is_staff ? 'Remove admin' : 'Set admin'}</button>
                  <button className="btn ghost" onClick={() => askAction(u, 'delete')}>Delete</button>
                  <button className="btn ghost" onClick={() => askAction(u, 'toggle_upload')}>Toggle upload</button>
                  {/* Аналогично для других toggles */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{marginTop:10}} className="small-muted">{msg}</div>
      </div>

      <ConfirmModal
        open={confirm.open}
        title={`${confirm.action.charAt(0).toUpperCase() + confirm.action.slice(1)} user`}
        text={`User: ${confirm.user?.username}`}
        onCancel={() => setConfirm({ open: false, user: null, action: '' })}
        onConfirm={performAction}
      />
    </div>
  );
}

function formatBytes(b){
  if(!b && b!==0) return '0 B';
  const units = ['B','KB','MB','GB','TB'];
  let i=0; let val = b;
  while(val >= 1024 && i < units.length-1){ val/=1024; i++; }
  return `${val.toFixed(val<10 && i>0 ? 2 : 0)} ${units[i]}`;
}