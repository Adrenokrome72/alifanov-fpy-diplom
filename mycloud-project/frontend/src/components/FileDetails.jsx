// frontend/src/components/FileDetails.jsx
import React, { useState } from "react";
import apiFetch from "../api";
import { showToast } from "../utils/toast";
import formatBytes from "../utils/formatBytes";

export default function FileDetails({ file, onClose, onDelete, onShare }) {
  // file can be either a file object or folder object (we'll detect by presence of 'original_name')
  if (!file) return null;
  const isFile = !!file.original_name;

  if (isFile) {
    return <FileInfo file={file} onClose={onClose} onDelete={onDelete} onShare={onShare} />;
  } else {
    return <FolderInfo folder={file} onClose={onClose} onDelete={onDelete} onShare={onShare} />;
  }
}

function FileInfo({ file, onClose, onDelete, onShare }) {
  const [editing, setEditing] = useState(false);
  // separate base and ext
  const idx = file.original_name.lastIndexOf(".");
  const base = idx > 0 ? file.original_name.slice(0, idx) : file.original_name;
  const ext = idx > 0 ? file.original_name.slice(idx) : "";
  const [name, setName] = useState(base);
  const [comment, setComment] = useState(file.comment || "");
  const [downloads, setDownloads] = useState(file.downloads_count || file.downloads || 0);

  const doRename = async () => {
    if (!name.trim()) return showToast("Имя не может быть пустым", { type: "error" });
    try {
      const res = await apiFetch(`/api/files/${file.id}/rename/`, { method: "POST", body: { name } });
      showToast("Переименовано", { type: "success" });
      setEditing(false);
      // update UI: ideally caller will refresh list; we can refresh locally:
    } catch (e) {
      showToast("Ошибка переименования", { type: "error" });
    }
  };

  const doSaveComment = async () => {
    try {
      const res = await apiFetch(`/api/files/${file.id}/`, { method: "PATCH", body: { comment } });
      showToast("Комментарий сохранён", { type: "success" });
    } catch (e) {
      showToast("Ошибка сохранения комментария", { type: "error" });
    }
  };

  const doDownload = async () => {
    try {
      // Navigate to download endpoint (this triggers backend increment)
      const url = `/api/files/${file.id}/download/`;
      // create anchor
      const a = document.createElement("a");
      a.href = url;
      // let browser download with existing session (cookies)
      document.body.appendChild(a);
      a.click();
      a.remove();
      // increment local downloads count (backend also increments)
      setDownloads((d) => (d || 0) + 1);
    } catch (e) {
      showToast("Ошибка скачивания", { type: "error" });
    }
  };

  return (
    <div className="card p-4" style={{position:"fixed", right:20, bottom:20, width:360}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <div style={{fontWeight:700}}>{editing ? `${name}${ext}` : file.original_name}</div>
          <div style={{fontSize:12, color:"#6b7280"}}>{file.owner_full_name || file.owner_username}</div>
        </div>
        <div style={{display:"flex", gap:8}}>
          {!editing && <button className="btn" onClick={()=>setEditing(true)}>Переименовать</button>}
          {editing && <button className="btn" onClick={doRename}>Сохранить</button>}
          <button className="btn" onClick={()=> onDelete(file.id)}>Удалить</button>
        </div>
      </div>

      <div style={{marginTop:12}}>
        <div style={{fontSize:12, color:"#6b7280"}}>Тип: {ext || "(без расширения)"}</div>
        <div style={{fontSize:12, color:"#6b7280"}}>Размер: {formatBytes(file.size)}</div>
        <div style={{fontSize:12, color:"#6b7280"}}>Загрузок: {downloads} {file.last_downloaded_at ? ` (послед. скачивание: ${new Date(file.last_downloaded_at).toLocaleString()})` : ""}</div>

        <div style={{marginTop:8}}>
          <div style={{fontSize:12, color:"#6b7280"}}>Комментарий</div>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} style={{width:"100%", minHeight:80}} />
          <div style={{display:"flex", gap:8, marginTop:8}}>
            <button className="btn" onClick={doSaveComment}>Сохранить</button>
            <button className="btn" onClick={doDownload}>Скачать</button>
            <button className="btn" onClick={()=>onShare(file.id)}>Поделиться</button>
            <button className="btn" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FolderInfo({ folder, onClose, onDelete, onShare }) {
  const [name, setName] = useState(folder.name);
  const [editing, setEditing] = useState(false);

  const doRename = async () => {
    if (!name.trim()) return showToast("Введите имя", { type: "error" });
    try {
      await apiFetch(`/api/folders/${folder.id}/rename/`, { method: "POST", body: { name } });
      showToast("Переименовано", { type: "success" });
      setEditing(false);
    } catch (e) {
      showToast("Ошибка при переименовании папки", { type: "error" });
    }
  };

  const doDelete = async () => {
    if (!confirm("Удалить папку и всё в ней?")) return;
    try {
      await apiFetch(`/api/folders/${folder.id}/purge/`, { method: "DELETE" });
      showToast("Папка удалена", { type: "success" });
      if (onDelete) onDelete(folder.id);
    } catch (e) {
      showToast("Ошибка при удалении папки", { type: "error" });
    }
  };

  const doDownloadZip = async () => {
    // call /api/folders/{id}/download_zip/ which returns zip
    try {
      const a = document.createElement("a");
      a.href = `/api/folders/${folder.id}/download_zip/`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      showToast("Ошибка скачивания папки", { type: "error" });
    }
  };

  const doShare = async () => {
    try {
      const res = await apiFetch(`/api/folders/${folder.id}/share/`, { method: "POST" });
      if (res && res.share_url) {
        navigator.clipboard?.writeText(res.share_url);
        showToast("Ссылка скопирована в буфер обмена", { type: "success" });
      } else {
        showToast("Ссылка не получена", { type: "error" });
      }
    } catch (e) {
      showToast("Ошибка при шаринге папки", { type: "error" });
    }
  };

  return (
    <div className="card p-4" style={{position:"fixed", right:20, bottom:20, width:360}}>
      <div>
        <div style={{fontWeight:700}}>{editing ? <input value={name} onChange={e=>setName(e.target.value)} /> : folder.name}</div>
        <div style={{fontSize:12, color:"#6b7280"}}>Владелец: {folder.owner_full_name || folder.owner_username}</div>
        <div style={{marginTop:8, fontSize:12, color:"#6b7280"}}>{folder.children_count || 0} папок, {folder.files_count || 0} файлов</div>
        <div style={{marginTop:12, display:"flex", gap:8}}>
          {editing ? <button className="btn" onClick={doRename}>Сохранить</button> : <button className="btn" onClick={()=>setEditing(true)}>Переименовать</button>}
          <button className="btn" onClick={doDelete}>Удалить</button>
          <button className="btn" onClick={doDownloadZip}>Скачать ZIP</button>
          <button className="btn" onClick={doShare}>Поделиться</button>
          <button className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
