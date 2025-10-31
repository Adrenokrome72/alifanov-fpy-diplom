import React from 'react';
import { Link } from 'react-router-dom';

export default function NavBar(){
  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex gap-4">
        <Link to="/" className="font-bold">My Cloud</Link>
        <Link to="/files">Files</Link>
        <Link to="/admin">Admin</Link>
        <div className="ml-auto">
          <Link to="/login" className="mr-2">Login</Link>
          <Link to="/register">Register</Link>
        </div>
      </div>
    </nav>
  );
}