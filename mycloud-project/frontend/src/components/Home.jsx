// frontend/src/components/Home.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import formatBytes from "../utils/formatBytes";

export default function Home() {
  const user = useSelector((s) => s.auth.user);
  const profile = user?.profile ?? null;

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-3xl font-bold">MyCloud — личное облачное хранилище</h1>
        <p className="mt-3 text-gray-700">
          Храните файлы, создавайте папки, делитесь контентом и управляйте доступом.
          Проект реализован как учебная демонстрация fullstack-навыков: Django + DRF на
          бэкенде и React + Redux на фронтенде.
        </p>

        <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex gap-2">
            <Link to="/files" className="px-4 py-2 bg-sky-600 text-white rounded">Перейти к файлам</Link>
            {!user && <Link to="/register" className="px-4 py-2 border rounded">Регистрация</Link>}
            {!user && <Link to="/login" className="px-4 py-2 border rounded">Вход</Link>}
          </div>

          {user && (
            <div className="text-sm text-gray-600">
              Вошёл: <strong>{user.username}</strong>
              {profile && (
                <span className="ml-4">Использовано: {formatBytes(profile.used_bytes ?? 0)} / {profile.quota ? formatBytes(profile.quota) : "не установлено"}</span>
              )}
            </div>
          )}
        </div>

        <hr className="my-6" />

        <section>
          <h2 className="text-xl font-semibold">Короткое руководство</h2>
          <ul className="list-disc ml-5 mt-2 text-gray-700 space-y-1">
            <li>Загрузите файлы на страницу «Files» — можно указывать комментарий и папку.</li>
            <li>Создавайте папки и перемещайте файлы между ними.</li>
            <li>Сгенерируйте внешнюю ссылку для скачивания — её можно дать неавторизованным пользователям.</li>
            <li>Если вы администратор — откройте панель «Admin» для управления пользователями и квотами.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
