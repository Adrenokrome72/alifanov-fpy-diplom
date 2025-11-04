// frontend/src/components/NavBar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../features/authSlice";

export default function NavBar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);

  const onLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      navigate("/login");
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-bold text-lg">MyCloud</Link>
          <nav className="hidden md:flex gap-3">
            <Link to="/" className="text-sm hover:underline">Home</Link>
            <Link to="/files" className="text-sm hover:underline">Files</Link>
            {user && user.is_staff && <Link to="/admin" className="text-sm hover:underline">Admin</Link>}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!user && (
            <>
              <Link to="/login" className="px-3 py-1 border rounded">Login</Link>
              <Link to="/register" className="px-3 py-1 bg-sky-600 text-white rounded">Register</Link>
            </>
          )}

          {user && (
            <>
              <div className="text-sm text-gray-700 mr-2">Hi, {user.username}</div>
              <button onClick={onLogout} className="px-3 py-1 border rounded">Logout</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
