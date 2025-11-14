import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import NavBar from "./components/NavBar";
import FileManager from "./components/FileManager";
import Login from "./components/Login";
import Register from "./components/Register";
import AdminPanel from "./components/AdminPanel";
import Home from "./components/Home";
import AdminStorageView from "./components/AdminStorageView";
import { fetchCurrentUser } from "./features/authSlice";

export default function App() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const authStatus = useSelector((s) => s.auth.status);

  useEffect(() => {
    if (typeof fetchCurrentUser === "function") {
      dispatch(fetchCurrentUser()).catch(()=>{});
      window.fetchCurrentUser = async () => {
        try {
          await dispatch(fetchCurrentUser()).unwrap();
        } catch (e) {
        }
      };
    }
  }, [dispatch]);

  if (authStatus === "loading") {
    return <div className="app-loading">Loading…</div>;
  }

  return (
    <>
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/files" element={user ? <FileManager /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/files" replace />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/files" replace />} />
          <Route path="/admin/storage/:userId" element={<AdminStorageView />} />
          {user && user.is_staff && <Route path="/admin" element={<AdminPanel />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}