import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api/axios';
import { useDispatch, useSelector } from 'react-redux';

function useMounted() {
  const m = useRef(true);
  useEffect(() => () => { m.current = false; }, []);
  return m;
}

export default function CloudExplorer() {
  const [currentFolder, setCurrentFolder] = useState(null);
  const [sortBy, setSortBy] = useState('uploaded_at');
  const [dropActive, setDropActive] = useState(false);
  const [msg, setMsg] = useState('');
  const dispatch = useDispatch();
  const { folders, files } = useSelector((state) => state);
  const mounted = useMounted();

  const loadFolders = useCallback(async () => {
    try {
      const r = await api.get('/storage/folders/');
      if (!mounted.current) return;
      dispatch({ type: 'SET_FOLDERS', payload: r.data || [] });
      if (r.data.length && currentFolder == null) {
        const id = r.data[0].id;
        setCurrentFolder(id);
        await loadFiles(id);
      }
    } catch (e) {
      console.error('loadFolders', e);
      setMsg('Error loading folders: ' + (e.response?.data?.detail || e.message));
    }
  }, [dispatch, mounted, currentFolder, loadFiles]); // Добавил loadFiles если используется внутри

  const loadFiles = useCallback(async (folderId, order = sortBy) => {
    try {
      const r = await api.get(`/storage/files/?folder_id=${folderId || ''}&order_by=${order}`);
      if (!mounted.current) return;
      dispatch({ type: 'SET_FILES', payload: r.data || [] });
      setCurrentFolder(folderId);
    } catch (e) {
      console.error('loadFiles', e);
      setMsg('Error loading files: ' + (e.response?.data?.detail || e.message));
    }
  }, [dispatch, mounted, sortBy]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (currentFolder !== null) {
      loadFiles(currentFolder);
    }
  }, [sortBy, currentFolder, loadFiles]);

  async function createFolder(name, parentId = null) {
    try {
      const r = await api.post('/storage/folders/create/', { name, parent: parentId });
      dispatch({ type: 'SET_FOLDERS', payload: [...folders, r.data] });
      setCurrentFolder(r.data.id);
      await loadFiles(r.data.id);
    } catch (e) {
      console.error('createFolder', e);
      setMsg('Error creating folder');
    }
  }

  async function renameFolder(id, newName) {
    try {
      await api.post(`/storage/folders/${id}/rename/`, { name: newName });
      dispatch({ type: 'SET_FOLDERS', payload: folders.map(f => f.id === id ? { ...f, name: newName } : f) });
    } catch (e) {
      console.error('renameFolder', e);
    }
  }

  async function deleteFolder(id) {
    try {
      await api.delete(`/storage/folders/${id}/delete/`);
      dispatch({ type: 'SET_FOLDERS', payload: folders.filter(f => f.id !== id) });
      if (currentFolder === id) {
        setCurrentFolder(null);
        dispatch({ type: 'SET_FILES', payload: [] });
      }
    } catch (e) {
      console.error('deleteFolder', e);
    }
  }

  async function uploadFileToFolder(file, folderId) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('comment', '');
      fd.append('folder', folderId ?? '');
      const r = await api.post('/storage/files/upload/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadFiles(folderId);
      return r.data;
    } catch (e) {
      console.error('uploadFileToFolder', e);
      setMsg('Upload failed: ' + (e.response?.data?.detail || e.message));
    }
  }

  async function moveFileTo(fileId, targetFolderId) {
    try {
      await api.post(`/storage/files/${fileId}/move/`, { target_folder: targetFolderId });
      await loadFiles(currentFolder);
    } catch (e) {
      console.error('moveFileTo', e);
    }
  }

  function onDragOver(e) { e.preventDefault(); setDropActive(true); }
  function onDragLeave() { setDropActive(false); }
  async function onDrop(e) {
    e.preventDefault(); setDropActive(false);
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      for (let i = 0; i < dt.files.length; i++) {
        await uploadFileToFolder(dt.files[i], currentFolder);
      }
    }
  }

  async function copyShareLink(shareLink) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/api/storage/share/${shareLink}/`);
      setMsg('Share link copied');
    } catch (e) {
      setMsg('Failed to copy link');
    }
  }

  return (
    <div className="card fm">
      <div className="tree card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Папки</strong>
          <button className="btn ghost" onClick={async () => { const n = prompt('Название папки'); if (n) await createFolder(n, null); }}>New</button>
        </div>

        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {folders.map(f => (
            <div key={f.id}
              className={`folder ${f.id === currentFolder ? 'active' : ''}`}
              draggable
              onDragStart={(ev) => { ev.dataTransfer.setData('text/folder', f.id); }}
              onDragOver={(ev) => { ev.preventDefault(); }}
              onDrop={async (ev) => { ev.preventDefault(); const fileId = ev.dataTransfer.getData('application/file-id'); if (fileId) await moveFileTo(fileId, f.id); }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => loadFiles(f.id)}>
                <div style={{ fontWeight: 600 }}>{f.name}</div>
                <div className="small">{f.child_count ?? 0} items</div>
              </div>
              <div className="folder-actions" onClick={(ev) => ev.stopPropagation()}>
                <button className="btn ghost" onClick={async () => { const nm = prompt('Новое имя', f.name); if (nm) await renameFolder(f.id, nm); }}>Rename</button>
                <button className="btn ghost" onClick={async () => { if (window.confirm('Удалить?')) await deleteFolder(f.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="files card">
        <div className="toolbar">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="breadcrumbs small-muted">Folder: {folders.find(x => x.id === currentFolder)?.name || 'Root'}</div>
            <div className="small-muted">•</div>
            <div className="small-muted">{files.length} files</div>
          </div>
          <div className="row">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="uploaded_at">Date asc</option>
              <option value="-uploaded_at">Date desc</option>
              <option value="name">Name asc</option>
              <option value="-name">Name desc</option>
              <option value="size">Size asc</option>
              <option value="-size">Size desc</option>
            </select>
            <label className="folder-new">
              <input type="file" style={{ display: 'none' }} onChange={async (e) => { if (e.target.files[0]) await uploadFileToFolder(e.target.files[0], currentFolder); }} />
              <span style={{ cursor: 'pointer' }}>Upload file</span>
            </label>
            <button className="btn ghost" onClick={() => loadFiles(currentFolder)}>Refresh</button>
          </div>
        </div>

        <div className={`drop-area ${dropActive ? 'dragover' : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} style={{ marginTop: 12, padding: 12, borderRadius: 12 }}>
          <div className="small-muted">Drag & drop files here to upload to current folder</div>

          <div style={{ marginTop: 12 }} className="files-grid">
            {files.map(f => (
              <FileCard key={f.id} file={f} onMove={moveFileTo} refresh={() => loadFiles(currentFolder)} copyShareLink={copyShareLink} />
            ))}
            {files.length === 0 && <div style={{ padding: 12 }} className="small-muted">No files</div>}
          </div>
        </div>
        <div className="small-muted">{msg}</div>
      </div>
    </div>
  );
}

function FileCard({ file, onMove, refresh, copyShareLink }) {
  const [dragging, setDragging] = useState(false);
  function onDragStart(e) { e.dataTransfer.setData('application/file-id', String(file.id)); setDragging(true); }
  function onDragEnd() { setDragging(false); }

  return (
    <div className={`file-card ${dragging ? 'dragging' : ''}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} style={{ border: file.has_share ? '1px solid blue' : '1px dashed transparent' }}>
      <div className="file-thumb">
        {file.thumbnail ? <img src={file.thumbnail} alt={file.name} /> : <div style={{ fontSize: 28, color: '#64748b' }}>{file.name.split('.').pop()?.toUpperCase() || 'FILE'}</div>}
      </div>
      <div style={{ width: '100%' }}>
        <div className="file-name">{file.name}</div>
        <div className="file-meta">
          <div>{formatBytes(file.size)}</div>
          <div style={{ marginLeft: 'auto' }} className="small-muted">{file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <a className="btn ghost" href={file.download_url} target="_blank" rel="noreferrer">Download</a>
          <button className="btn ghost" onClick={() => copyShareLink(file.share_link)}>Share</button>
          <button className="btn ghost" onClick={async () => { const nm = prompt('New name', file.name); if (nm) { await api.post(`/storage/files/${file.id}/rename/`, { name: nm }); refresh(); } }}>Rename</button>
          <button className="btn ghost" onClick={async () => { if (window.confirm('Delete?')) { await api.delete(`/storage/files/${file.id}/delete/`); refresh(); } }}>Delete</button>
          <button className="btn ghost" onClick={async () => { await onMove(file.id, null); refresh(); }}>Move to root</button>
        </div>
      </div>
    </div>
  );
}

function formatBytes(b) {
  if (!b && b !== 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = b;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 2 : 0)} ${units[i]}`;
}