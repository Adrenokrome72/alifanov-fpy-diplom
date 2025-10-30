import React, { useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const dispatch = useDispatch();
  const { storage, user } = useSelector((state) => state);

  const loadStorage = useCallback(async () => {
    try {
      const r = await api.get('/users/');
      const currentUser = r.data.find((u) => u.username === user?.username);
      if (currentUser) {
        dispatch({ type: 'SET_STORAGE', payload: { used: currentUser.used_storage, limit: currentUser.storage_limit } });
      }
    } catch (e) {
      console.error('loadStorage', e);
    }
  }, [dispatch, user]);

  useEffect(() => {
    if (user) loadStorage();
  }, [user, loadStorage]);

  return (
    <div>
      <h1>My Cloud Dashboard</h1>
      <p>Storage: {formatBytes(storage.used)} / {formatBytes(storage.limit)} used</p>
      <Link to="/explorer">Go to File Explorer</Link>
      <Link to="/admin">Admin Panel (if admin)</Link>
      {/* Add logout button */}
    </div>
  );
}

function formatBytes(b) {
  if (!b && b !== 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = b;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 2 : 0)} ${units[i]}`;
}