import React, {useState} from 'react';
import api, { setCSRFCookieHeader } from '../api/axios';

export default function Register(){
  const [res, setRes] = useState(null);
  const submit = async (e)=> {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    const email = e.target.email.value;
    try {
      // ensure CSRF cookie/header set
      await api.get('/users/csrf/');
      setCSRFCookieHeader();
      const r = await api.post('/users/register/', { username, password, email });
      setRes(r.data);
    } catch (err) { setRes(err.response?.data || err.message); }
  };
  return (
    <form onSubmit={submit}>
      <input name="username" placeholder="username" />
      <input name="email" placeholder="email" />
      <input name="password" placeholder="password" type="password" />
      <button type="submit">Register</button>
      <pre>{JSON.stringify(res,null,2)}</pre>
    </form>
  );
}