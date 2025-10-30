import React, { useState } from 'react';
import api, { setCSRFCookieHeader } from '../api/axios';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [res, setRes] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.get('/users/csrf/');
      setCSRFCookieHeader();
      const { data } = await api.post('/users/login/', {
        username: e.target.username.value,
        password: e.target.password.value,
      });
      setRes(data);
      dispatch({ type: 'SET_USER', payload: { username: e.target.username.value } });
      navigate('/explorer');
    } catch (err) {
      setRes(err.response?.data || err.message);
    }
  };

  return (
    <form onSubmit={submit}>
      <input name="username" placeholder="Username" />
      <input name="password" type="password" placeholder="Password" />
      <button type="submit">Login</button>
      <pre>{JSON.stringify(res, null, 2)}</pre>
    </form>
  );
}