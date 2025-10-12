import React, {useState} from 'react';
import api, { setCSRFCookieHeader } from '../api/axios';

export default function Login(){
  const [res,setRes] = useState(null);
  const submit = async (e)=>{
    e.preventDefault();
    try {
      await api.get('/users/csrf/');
      setCSRFCookieHeader();
      const { data } = await api.post('/users/login/', {
        username: e.target.username.value,
        password: e.target.password.value
      });
      setRes(data);
    } catch (err) {
      setRes(err.response?.data || err.message);
    }
  };
  return (
    <form onSubmit={submit}>
      <input name="username" />
      <input name="password" type="password" />
      <button>Login</button>
      <pre>{JSON.stringify(res,null,2)}</pre>
    </form>
  );
}
