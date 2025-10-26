// frontend/src/components/CloudExplorer.js
import React, { useEffect, useState, useRef } from 'react';
import api, { initCsrf, setCSRFCookieHeader } from '../api/axios';
import FileUpload from './FileUpload';

function useMounted(){
  const m = useRef(true);
  useEffect(()=>()=>{m.current=false},[]);
  return m;
}

export default function CloudExplorer(){
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const mounted = useMounted();

  useEffect(()=>{ (async ()=>{ await initCsrf(); setCSRFCookieHeader(); loadFolders(); })(); }, []);

  async function loadFolders(){
    try{
      const r = await api.get('/storage/folders/');
      if(!mounted.current) return;
      setFolders(r.data || []);
      if(r.data && r.data.length && currentFolder == null){
        const id = r.data[0].id;
        setCurrentFolder(id);
        await loadFiles(id);
      }
    }catch(e){
      console.error('loadFolders', e);
    }
  }

  async function loadFiles(folderId){
    setLoading(true);
    try{
      const r = await api.get(`/storage/files/?folder_id=${folderId}`);
      if(!mounted.current) return;
      setFiles(r.data || []);
      setCurrentFolder(folderId);
    }catch(e){
      console.error('loadFiles', e);
    }finally{ setLoading(false) }
  }

  async function createFolder(name, parentId = null){
    try{
      await initCsrf(); setCSRFCookieHeader();
      const r = await api.post('/storage/folders/create/', { name, parent: parentId });
      // сервер вернул объект — добавим и перейдём к нему
      setFolders(prev => [r.data, ...prev]);
      setCurrentFolder(r.data.id);
      await loadFiles(r.data.id);
    }catch(e){ console.error('createFolder', e) }
  }

  async function renameFolder(id, newName){
    try{
      await initCsrf(); setCSRFCookieHeader();
      const r = await api.post(`/storage/folders/${id}/rename/`, { name: newName });
      setFolders(prev => prev.map(f => f.id===id ? r.data : f));
    }catch(e){ console.error('renameFolder', e) }
  }

  async function deleteFolder(id){
    try{
      await initCsrf(); setCSRFCookieHeader();
      await api.delete(`/storage/folders/${id}/`);
      setFolders(prev => prev.filter(f => f.id !== id));
      if(currentFolder === id){
        setFiles([]);
        setCurrentFolder(prev => prev === id ? (folders[0]?.id ?? null) : prev);
      }
    }catch(e){ console.error('deleteFolder', e) }
  }

  async function uploadFileToFolder(file, folderId){
    try{
      await initCsrf(); setCSRFCookieHeader();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('comment', '');
      fd.append('folder', folderId ?? '');
      const r = await api.post('/storage/files/upload/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      // обновим список файлов с сервера (чтобы корректно получить id/size/etc)
      await loadFiles(folderId);
      return r.data;
    }catch(e){
      console.error('uploadFileToFolder', e);
      throw e;
    }
  }

  async function moveFileTo(fileId, targetFolderId){
    try{
      await initCsrf(); setCSRFCookieHeader();
      await api.post(`/storage/files/${fileId}/move/`, { target_folder: targetFolderId });
      // после перемещения просто обновим списки обеих папок
      await loadFiles(currentFolder);
      if(targetFolderId && targetFolderId !== currentFolder){
        // naive: reload target folder list if needed (not tracked)
      }
    }catch(e){
      console.error('moveFileTo', e);
    }
  }

  // drag-n-drop handlers
  function onDragOver(e){ e.preventDefault(); setDropActive(true);}
  function onDragLeave(e){ setDropActive(false);}
  async function onDrop(e){
    e.preventDefault(); setDropActive(false);
    const dt = e.dataTransfer;
    if(dt && dt.files && dt.files.length){
      for(let i=0;i<dt.files.length;i++){
        // sequential
        // eslint-disable-next-line no-await-in-loop
        await uploadFileToFolder(dt.files[i], currentFolder);
      }
    }
  }

  return (
    <div className="card fm">
      <div className="tree card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <strong>Папки</strong>
          <button className="btn ghost" onClick={async ()=>{ const n = prompt('Название папки'); if(n) await createFolder(n,null); }}>New</button>
        </div>

        <div style={{marginTop:8, display:'flex',flexDirection:'column',gap:6}}>
          {folders.map(f => (
            <div key={f.id}
                 className={`folder ${f.id===currentFolder? 'active':''}`}
                 draggable
                 onDragStart={(ev)=>{ ev.dataTransfer.setData('text/folder', f.id) }}
                 onDragOver={(ev)=>{ ev.preventDefault(); }}
                 onDrop={async (ev)=>{ ev.preventDefault(); const fileId = ev.dataTransfer.getData('application/file-id') || ev.dataTransfer.getData('text/plain'); if(fileId) await moveFileTo(fileId, f.id); }}>
              <div style={{flex:1, cursor:'pointer'}} onClick={()=>loadFiles(f.id)}>
                <div style={{fontWeight:600}}>{f.name}</div>
                <div className="small">{f.child_count ?? 0} items</div>
              </div>
              <div className="folder-actions" onClick={(ev)=>ev.stopPropagation()}>
                <button className="btn ghost" onClick={async ()=>{ const nm = prompt('Новое имя', f.name); if(nm) await renameFolder(f.id, nm); }}>Rename</button>
                <button className="btn ghost" onClick={async ()=>{ if(window.confirm('Удалить?')) await deleteFolder(f.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="files card">
        <div className="toolbar">
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div className="breadcrumbs small-muted">Folder: {folders.find(x=>x.id===currentFolder)?.name || '—'}</div>
            <div className="small-muted">•</div>
            <div className="small-muted">{files.length} files</div>
          </div>
          <div className="row">
            <label className="folder-new">
              <input type="file" style={{display:'none'}} onChange={async (e)=>{ if(e.target.files[0]) await uploadFileToFolder(e.target.files[0], currentFolder); }} />
              <span style={{cursor:'pointer'}}>Upload file</span>
            </label>
            <button className="btn ghost" onClick={()=>{ setFiles([]); loadFiles(currentFolder); }}>Refresh</button>
          </div>
        </div>

        <div className={`drop-area ${dropActive ? 'dragover':''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} style={{marginTop:12,padding:12,borderRadius:12}}>
          <div className="small-muted">Drag & drop files here to upload to current folder</div>

          <div style={{marginTop:12}} className="files-grid">
            {files.map(f => <FileCard key={f.id} file={f} onMove={moveFileTo} refresh={()=>loadFiles(currentFolder)} />)}
            {files.length===0 && <div style={{padding:12}} className="small-muted">No files</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function FileCard({file, onMove, refresh}){
  const [dragging, setDragging] = useState(false);
  function onDragStart(e){ e.dataTransfer.setData('application/file-id', String(file.id)); e.dataTransfer.setData('text/plain', String(file.id)); setDragging(true); }
  function onDragEnd(){ setDragging(false); }

  return (
    <div className={`file-card ${dragging ? 'dragging' : ''}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="file-thumb">
        {file.original_name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <img src={file.download_url} alt={file.original_name} /> : <div style={{fontSize:28,color:'#64748b'}}>{file.original_name.split('.').pop()?.toUpperCase()||'FILE'}</div>}
      </div>
      <div style={{width:'100%'}}>
        <div className="file-name">{file.original_name}</div>
        <div className="file-meta">
          <div>{file.size ? formatBytes(file.size) : '-'}</div>
          <div style={{marginLeft:'auto'}} className="small-muted">{file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : ''}</div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <a className="btn ghost" href={file.download_url} target="_blank" rel="noreferrer">Download</a>
          <button className="btn ghost" onClick={async ()=>{ await onMove(file.id, null); refresh && refresh(); }}>Move to root</button>
        </div>
      </div>
    </div>
  );
}

function formatBytes(b){
  if(!b && b!==0) return '';
  const units = ['B','KB','MB','GB','TB'];
  let i=0; let val = b;
  while(val >= 1024 && i < units.length-1){ val/=1024; i++; }
  return `${val.toFixed(val<10 && i>0 ? 2 : 0)} ${units[i]}`;
}
