import React, { useState } from 'react';
import api, { setCSRFCookieHeader } from '../api/axios';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [res, setRes] = useState(null);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    const email = e.target.email.value;
    try {
      await api.get('/users/csrf/');
      setCSRFCookieHeader();
      const r = await api.post('/users/register/', { username, password, email });
      setRes(r.data);
      navigate('/login');
    } catch (err) {
      setRes(err.response?.data || err.message);
    }
  };

  return (
    <form onSubmit={submit}>
      <input name="username" placeholder="Username (4-20 chars, starts with letter, alphanum)" />
      <input name="email" placeholder="Email" />
      <input name="password" placeholder="Password (min 6 chars, 1 upper, 1 digit, 1 special)" type="password" />
      <button type="submit">Register</button>
      <pre>{JSON.stringify(res, null, 2)}</pre>
    </form>
  );
}