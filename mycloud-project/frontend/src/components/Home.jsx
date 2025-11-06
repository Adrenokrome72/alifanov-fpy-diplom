import React from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import formatBytes from "../utils/formatBytes";

const DEFAULT_QUOTA = 10 * 1024 * 1024 * 1024; // 10 GB

export default function Home() {
  const user = useSelector(s => s.auth.user);
  const profile = user?.profile ?? null;

  // Show quota UI only when user is actually logged in
  const showQuota = Boolean(user && profile !== null);

  const used = showQuota ? (profile?.used_bytes ?? 0) : 0;
  const quotaRaw = showQuota ? (profile?.quota ?? null) : null;
  const quota = quotaRaw !== null ? quotaRaw : DEFAULT_QUOTA;
  const remaining = Math.max(0, quota - used);
  const percentUsed = quota ? Math.round((used / quota) * 100) : 0;

  return (
    <div className="container mx-auto p-6">
      <div className="card bg-white shadow rounded p-6">
        <h1 className="font-bold text-2xl">Добро пожаловать в MyCloud</h1>
        <p className="text-gray-600 mt-2">Простое и удобное облачное хранилище для учебного проекта.</p>

        <div style={{marginTop:18, display:"flex", justifyContent:"space-between", alignItems:"center", gap:16}}>
          <div style={{flex:1}}>
            <Link to="/files" className="btn btn-primary bg-sky-600 text-white px-4 py-2 rounded">Открыть файловый менеджер</Link>
          </div>

          {showQuota && (
            <div style={{width:360}}>
              <div className="text-sm text-gray-600">Место</div>
              <div style={{marginTop:6}}>
                <div style={{height:12, background:"#f1f5f9", borderRadius:8, overflow:"hidden"}}>
                  <div style={{
                    height:"100%",
                    width: `${Math.min(100, Math.max(0, Math.round((used / quota) * 100))) }%`,
                    background: `linear-gradient(90deg,#06b6d4,#10b981)`
                  }} />
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  { `${formatBytes(remaining)} свободно из ${formatBytes(quota)} (${percentUsed}% занято)` }
                </div>
              </div>
            </div>
          )}
        </div>

        <hr className="mt-6 mb-4" />

        <div className="text-gray-700">
          <h3 className="font-semibold">Кратко</h3>
          <ul className="text-sm text-gray-600 mt-2">
            <li>Загружайте файлы, создавайте папки и делитесь ссылками.</li>
            <li>Администратор может управлять пользователями и квотами.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
