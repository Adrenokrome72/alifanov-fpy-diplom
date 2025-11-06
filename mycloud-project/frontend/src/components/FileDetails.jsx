// frontend/src/components/FileDetails.jsx
import React, { useState } from "react";
import apiFetch from "../api";
import { showToast } from "../utils/toast";
import formatBytes from "../utils/formatBytes";

/*
  Изменения:
   - FileDetails НЕ выполняет DELETE сам — вместо этого вызывает onDelete(file.id).
   - Переименование осуществляется через API (rename endpoint); при успехе — событие mycloud:content-changed.
   - Комментарий редактируется и отправляется через PATCH на /api/files/{id}/
*/

export default function FileDetails({ file, onClose, onDelete, onShare }) {
  if (!file) return null;
  return file.original_name
    ? <FileInfo file={file} onClose={onClose} onDelete={onDelete} onShare={onShare} />
    : <FolderInfo folder={file} onClose={onClose} onDelete={onDelete} onShare={onShare} />;
}

function FileInfo({ file, onClose, onDelete, onShare }) {
  const idx = file.original_name ? file.original_name.lastIndexOf(".") : -1;
  const base = idx > 0 ? file.original_name.slice(0, idx) : file.original_name;
  const ext = idx > 0 ? file.original_name.slice(idx) : "";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(base);
  const [comment, setComment] = useState(file.comment || "");
  const [downloads, setDownloads] = useState(file.downloads_count || file.downloads || 0);
  const [saving, setSaving] = useState(false);

  const doRename = async () => {
    const newBase = String(name || "").trim();
    if (!newBase) return showToast("Имя не может быть пустым", { type: "error" });
    setSaving(true);
    try {
      await apiFetch(`/api/files/${file.id}/rename/`, { method: "POST", body: { name: newBase } });
      showToast("Переименовано", { type: "success" });
      setEditing(false);
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (e) {
      showToast("Ошибка переименования", { type: "error" });
    } finally { setSaving(false); }
  };

  const doSaveComment = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/files/${file.id}/`, { method: "PATCH", body: { comment } });
      showToast("Комментарий сохранён", { type: "success" });
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (e) {
      showToast("Ошибка сохранения комментария", { type: "error" });
    } finally { setSaving(false); }
  };

  const doDownload = async () => {
    try {
      const a = document.createElement("a");
      a.href = `/api/files/${file.id}/download/`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDownloads((d) => (d || 0) + 1);
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (e) {
      showToast("Ошибка скачивания", { type: "error" });
    }
  };

  const doDelete = async () => {
    // Don't perform API call here; delegate to parent to avoid double-delete.
    if (onDelete) onDelete(file.id);
  };

  const doShare = async () => {
    try {
      const res = await apiFetch(`/api/files/${file.id}/share/`, { method: "POST" });
      if (res && res.share_url) {
        navigator.clipboard?.writeText(res.share_url);
        showToast("Ссылка скопирована в буфер обмена", { type: "success" });
      } else {
        showToast("Ссылка не получена", { type: "error" });
      }
    } catch (e) { showToast("Ошибка при шаринге файла", { type: "error" }); }
  };

  return (
    <div className="card p-4" style={{position:"fixed", right:20, bottom:20, width:"min(720px, 48vw)", maxWidth:"92vw"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
        <div style={{flex:1}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
            <div>
              <div style={{fontWeight:800, fontSize:16, wordBreak:"break-word"}}>{editing ? `${name}${ext}` : file.original_name}</div>
              <div style={{fontSize:12, color:"#6b7280"}}>{file.owner_full_name || file.owner_username || file.owner}</div>
            </div>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              {!editing && <button className="btn" onClick={()=>setEditing(true)}>Переименовать</button>}
              {editing && <button className="btn" onClick={doRename} disabled={saving}>{saving ? "..." : "Сохранить"}</button>}
              <button className="btn btn-danger" onClick={doDelete}>Удалить</button>
            </div>
          </div>

          <div style={{marginTop:12, display:"grid", gap:8}}>
            <div style={{fontSize:12, color:"#6b7280"}}>Тип: {ext || "(без расширения)"}</div>
            <div style={{fontSize:12, color:"#6b7280"}}>Размер: {formatBytes(file.size)}</div>
            <div style={{fontSize:12, color:"#6b7280"}}>Загрузок: {downloads} {file.last_downloaded_at ? ` (посл.: ${new Date(file.last_downloaded_at).toLocaleString()})` : ""}</div>

            <div>
              <div style={{fontSize:12, color:"#6b7280"}}>Комментарий</div>
              <textarea value={comment} onChange={e=>setComment(e.target.value)} style={{width:"100%", minHeight:80}} />
              <div style={{display:"flex", gap:8, marginTop:8}}>
                <button className="btn" onClick={doSaveComment} disabled={saving}>Сохранить</button>
                <button className="btn" onClick={doDownload}>Скачать</button>
                <button className="btn" onClick={doShare}>Поделиться</button>
                <button className="btn" onClick={onClose}>Закрыть</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FolderInfo({ folder, onClose, onDelete, onShare }) {
  const [name, setName] = useState(folder.name);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const doRename = async () => {
    if (!name.trim()) return showToast("Введите имя", { type: "error" });
    setBusy(true);
    try {
      await apiFetch(`/api/folders/${folder.id}/rename/`, { method: "POST", body: { name } });
      showToast("Переименовано", { type: "success" });
      setEditing(false);
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (e) { showToast("Ошибка при переименовании папки", { type: "error" }); }
    setBusy(false);
  };

  const doDelete = async () => {
    if (onDelete) onDelete(folder.id);
  };

  const doDownloadZip = async () => {
    try {
      const a = document.createElement("a");
      a.href = `/api/folders/${folder.id}/download_zip/`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { showToast("Ошибка скачивания папки", { type: "error" }); }
  };

  const doShare = async () => {
    try {
      const res = await apiFetch(`/api/folders/${folder.id}/share/`, { method: "POST" });
      if (res && res.share_url) {
        navigator.clipboard?.writeText(res.share_url);
        showToast("Ссылка скопирована в буфер обмена", { type: "success" });
      } else showToast("Ссылка не получена", { type: "error" });
    } catch (e) { showToast("Ошибка при шаринге папки", { type: "error" }); }
  };

  return (
    <div className="card p-4" style={{position:"fixed", right:20, bottom:20, width:"min(720px, 42vw)", maxWidth:"92vw"}}>
      <div>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700}}>{editing ? <input value={name} onChange={e=>setName(e.target.value)} /> : folder.name}</div>
            <div style={{fontSize:12, color:"#6b7280"}}>Владелец: {folder.owner_full_name || folder.owner_username || folder.owner}</div>
            <div style={{marginTop:8, fontSize:12, color:"#6b7280"}}>{folder.children_count || 0} папок, {folder.files_count || 0} файлов</div>
          </div>
          <div style={{display:"flex", gap:8}}>
            {editing ? <button className="btn" onClick={doRename} disabled={busy}>Сохранить</button> : <button className="btn" onClick={()=>setEditing(true)}>Переименовать</button>}
            <button className="btn btn-danger" onClick={doDelete}>Удалить</button>
          </div>
        </div>

        <div style={{marginTop:12, display:"flex", gap:8}}>
          <button className="btn" onClick={doDownloadZip}>Скачать ZIP</button>
          <button className="btn" onClick={doShare}>Поделиться</button>
          <button className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
