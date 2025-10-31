import React from 'react';
import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import Login from './components/Login';
import Register from './components/Register';
import FileManager from './components/FileManager';
import AdminDashboard from './components/AdminDashboard';

export default function App(){
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<div className="container mx-auto p-4">Welcome to My Cloud</div>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/files" element={<FileManager />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
      <footer className="bg-gray-100 p-4 text-center">My Cloud © 2025</footer>
    </div>
  );
}