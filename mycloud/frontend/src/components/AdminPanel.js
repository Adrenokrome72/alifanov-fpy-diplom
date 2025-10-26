// frontend/src/components/AdminPanel.js
import React, { useEffect, useState } from 'react';
import api, { initCsrf, setCSRFCookieHeader } from '../api/axios';
import ConfirmModal from './ConfirmModal';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState({ open: false, user: null });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function askToggleBlock(u) {
    setConfirm({ open: true, user: u });
  }

  async function toggleBlockConfirmed() {
    const u = confirm.user;
    if (!u) {
      setConfirm({ open: false, user: null });
      return;
    }
    // resilience: try multiple id fields
    const id = u.id ?? u.pk ?? u.user_id;
    if (!id) {
      setMsg('User id not found');
      setConfirm({ open: false, user: null });
      return;
    }

    try {
      setMsg('');
      await initCsrf();
      setCSRFCookieHeader();
      await api.post(`/users/${id}/toggle_block/`);
      setUsers(prev => prev.map(x => {
        const xid = x.id ?? x.pk ?? x.user_id;
        if (String(xid) === String(id)) {
          return { ...x, is_blocked: !x.is_blocked };
        }
        return x;
      }));
      setMsg('User status updated');
    } catch (e) {
      console.error('toggleBlock', e);
      setMsg('Ошибка при изменении статуса: ' + (e.response?.data?.detail || e.message));
    } finally {
      setConfirm({ open: false, user: null });
    }
  }

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
              <th>Files</th>
              <th>Storage</th>
              <th>Blocked</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const id = u.id ?? u.pk ?? u.user_id ?? '(no id)';
              return (
                <tr key={id}>
                  <td><strong>{u.username}</strong><div className="small">{(u.first_name || '') + ' ' + (u.last_name || '')}</div></td>
                  <td className="small">{u.email}</td>
                  <td>{u.is_staff ? 'Yes' : '-'}</td>
                  <td>{u.storage_count ?? '-'}</td>
                  <td>{typeof u.storage_bytes === 'number' ? formatBytes(u.storage_bytes) : '-'}</td>
                  <td>{u.is_blocked ? <span style={{color:'#a00'}}>Yes</span> : 'No'}</td>
                  <td>
                    <button className="btn ghost" onClick={() => askToggleBlock(u)}>{u.is_blocked ? 'Unblock' : 'Block'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{marginTop:10}} className="small-muted">{msg}</div>
      </div>

      <ConfirmModal
        open={confirm.open}
        title={confirm.user ? (confirm.user.is_blocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя') : 'Подтвердите'}
        text={confirm.user ? `Пользователь: ${confirm.user.username}` : ''}
        onCancel={() => setConfirm({ open: false, user: null })}
        onConfirm={toggleBlockConfirmed}
      />
    </div>
  );
}

function formatBytes(b){
  if(!b && b!==0) return '';
  const units = ['B','KB','MB','GB','TB'];
  let i=0; let val = b;
  while(val >= 1024 && i < units.length-1){ val/=1024; i++; }
  return `${val.toFixed(val<10 && i>0 ? 2 : 0)} ${units[i]}`;
}
