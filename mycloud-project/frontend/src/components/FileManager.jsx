// frontend/src/components/FileManager.jsx
import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchFiles,
  uploadFile as uploadFileThunk,
  deleteFile,
  downloadFile,
  shareFile,
  renameFile as renameFileThunk
} from "../features/filesSlice";
import {
  fetchFolders,
  createFolder,
  deleteFolder,
  renameFolder,
  shareFolder,
} from "../features/foldersSlice";
import { fetchCurrentUser } from "../features/authSlice";
import FileDetails from "./FileDetails";
import CreateFolderTile from "./CreateFolderTile";
import FolderTree from "./FolderTree";
import { showToast } from "../utils/toast";
import formatBytes from "../utils/formatBytes";
import apiFetch from "../api";
import { useLocation, useNavigate } from "react-router-dom";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function ownerIdOfFolder(f) {
  if (!f) return null;
  if (typeof f.owner === "number") return f.owner;
  if (f.owner && typeof f.owner === "object") return f.owner.id || f.owner.pk || null;
  return null;
}
function folderParentId(f) {
  if (!f) return null;
  if (typeof f.parent === "number") return f.parent;
  if (f.parent && typeof f.parent === "object") return f.parent.id || null;
  return null;
}
function fileFolderId(file) {
  if (!file) return null;
  if (typeof file.folder === "number") return file.folder;
  if (file.folder && typeof file.folder === "object") return file.folder.id || null;
  return null;
}

export default function FileManager() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const query = useQuery();
  const ownerParam = query.get("owner");
  const ownerMode = ownerParam ? Number(ownerParam) : null; // admin viewing specific user's storage

  const user = useSelector((s) => s.auth.user);
  const filesState = useSelector((s) => s.files);
  const foldersState = useSelector((s) => s.folders);

  const [localFiles, setLocalFiles] = useState([]);
  const [localFolders, setLocalFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [uploadComment, setUploadComment] = useState("");
  const fileInputRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  // counts (calculated)
  const [folderFilesCount, setFolderFilesCount] = useState({});
  const [folderChildrenCount, setFolderChildrenCount] = useState({});

  // --- initial load ---
  useEffect(() => {
    const init = async () => {
      try { await dispatch(fetchCurrentUser()).unwrap(); } catch (e) {}
      if (ownerMode) {
        // admin viewing someone else's storage
        try {
          const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/`);
          setLocalFiles(storage.files || []);
          setLocalFolders(storage.folders || []);
        } catch (err) {
          showToast("Не удалось загрузить хранилище пользователя", { type: "error" });
        }
      } else {
        // normal user: load root
        try { await dispatch(fetchFiles({ folder: null })).unwrap(); } catch (e) {}
        try { await dispatch(fetchFolders({ parent: null })).unwrap(); } catch (e) {}
        setLocalFiles(filesState.items || []);
        setLocalFolders(foldersState.list || []);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, ownerMode]);

  // sync redux -> local
  useEffect(() => {
    if (!ownerMode) {
      setLocalFiles(filesState.items || []);
      setLocalFolders(foldersState.list || []);
    }
  }, [filesState.items, foldersState.list, ownerMode]);

  // recalc counts
  useEffect(() => {
    const fcount = {};
    const children = {};
    (localFiles || []).forEach(file => {
      const fid = fileFolderId(file) ?? null;
      fcount[fid] = (fcount[fid] || 0) + 1;
    });
    (localFolders || []).forEach(folder => {
      const pid = folderParentId(folder);
      children[pid] = (children[pid] || 0) + 1;
    });
    setFolderFilesCount(fcount);
    setFolderChildrenCount(children);
  }, [localFiles, localFolders]);

  // listen for content-changed events -> refresh current folder & profile
  useEffect(() => {
    const onChange = async () => {
      if (ownerMode) {
        try {
          const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/?parent=${currentFolder ?? ""}`);
          setLocalFiles(storage.files || []);
          setLocalFolders(storage.folders || []);
        } catch (e) {}
      } else {
        try { await dispatch(fetchFiles({ folder: currentFolder ?? null })).unwrap(); } catch (e) {}
        try { await dispatch(fetchFolders({ parent: currentFolder ?? null })).unwrap(); } catch (e) {}
        try { await dispatch(fetchCurrentUser()).unwrap(); } catch(e){}
      }
    };
    window.addEventListener("mycloud:content-changed", onChange);
    return () => window.removeEventListener("mycloud:content-changed", onChange);
  }, [dispatch, ownerMode, currentFolder]);

  // visibleFolders: show only current user's folders unless ownerMode set
  const visibleFolders = (localFolders || []).filter(f => {
    if (ownerMode) return true; // viewing another user's storage -> show all returned
    if (!user) return false;
    // show only folders owned by current user (or system/global ones with no owner)
    const fid = ownerIdOfFolder(f);
    if (fid == null) return true;
    return Number(fid) === Number(user.id);
  });

  // open folder (sets currentFolder and fetches its children/files)
  const openFolder = async (folderId) => {
    setCurrentFolder(folderId);
    setSelectedFile(null);
    setSelectedFolder(null);
    if (ownerMode) {
      try {
        const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/?parent=${folderId || ""}`);
        setLocalFiles(storage.files || []);
        setLocalFolders(storage.folders || []);
      } catch (e) { showToast("Не удалось открыть папку", { type: "error" }); }
    } else {
      try {
        await dispatch(fetchFiles({ folder: folderId })).unwrap();
        await dispatch(fetchFolders({ parent: folderId })).unwrap();
      } catch (e) { showToast("Ошибка загрузки содержимого", { type: "error" }); }
    }
  };

  const openRoot = async () => {
    setCurrentFolder(null);
    setSelectedFile(null);
    setSelectedFolder(null);
    if (ownerMode) {
      try {
        const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/`);
        setLocalFiles(storage.files || []);
        setLocalFolders(storage.folders || []);
      } catch (e) { showToast("Не удалось открыть корень", { type: "error" }); }
    } else {
      try {
        await dispatch(fetchFiles({ folder: null })).unwrap();
        await dispatch(fetchFolders({ parent: null })).unwrap();
      } catch (e) {}
    }
  };

  // upload with progress (XHR so we can show progress)
  const uploadWithProgress = (file) => new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    if (currentFolder) form.append("folder", currentFolder);
    if (uploadComment) form.append("comment", uploadComment);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files/");
    xhr.withCredentials = true;
    const csrfCookie = (document.cookie || "").split(";").map(s=>s.trim()).find(s=>s.startsWith("csrftoken="));
    if (csrfCookie) xhr.setRequestHeader("X-CSRFToken", csrfCookie.split("=")[1]);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress({ percent: Math.round((e.loaded / e.total) * 100), name: file.name });
    };
    xhr.onload = () => {
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        try { const parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {}; resolve(parsed); } catch (e) { resolve({}); }
      } else {
        let msg = "Ошибка загрузки";
        try { const j = JSON.parse(xhr.responseText || "{}"); msg = j.detail || Object.values(j)[0] || msg; } catch(e){}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => { setUploadProgress(null); reject(new Error("Ошибка соединения")); };
    xhr.send(form);
  });

  const handleFileSelected = async (e) => {
    if (ownerMode) { showToast("В режиме просмотра чужого хранилища загрузка запрещена", { type: "error" }); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadWithProgress(file);
      setUploadComment("");
      // refresh
      await dispatch(fetchFiles({ folder: currentFolder }));
      await dispatch(fetchCurrentUser());
      showToast("Файл загружен", { type: "success" });
      // notify other components
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) {
      showToast(err.message || "Ошибка при загрузке файла", { type: "error" });
    }
    e.target.value = "";
  };

  // selection & open handlers
  const [lastClick, setLastClick] = useState({ id: null, time: 0 });
  const [editingFileId, setEditingFileId] = useState(null);

  const handleFileClick = (file) => {
    const now = Date.now();
    if (lastClick.id === `file-${file.id}` && (now - lastClick.time) < 350) {
      handleFileOpen(file);
      setLastClick({ id: null, time: 0 });
      return;
    }
    setLastClick({ id: `file-${file.id}`, time: now });
    setSelectedFile(file);
    setSelectedFolder(null);
  };
  const handleFileOpen = async (file) => {
    try {
      const a = document.createElement("a");
      a.href = `/api/files/${file.id}/download/`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await dispatch(fetchCurrentUser());
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) { showToast("Ошибка открытия файла", { type: "error" }); }
  };

  const handleDeleteFile = async (id) => {
    // centralised deletion — only here we call API
    try {
      await dispatch(deleteFile({ id })).unwrap();
      setSelectedFile(null);
      await dispatch(fetchFiles({ folder: currentFolder }));
      await dispatch(fetchCurrentUser());
      showToast("Файл удалён", { type: "success" });
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) { showToast("Ошибка удаления", { type: "error" }); }
  };

  const handleShareFile = async (id) => {
    try {
      await dispatch(shareFile({ id, action: "generate" })).unwrap();
      showToast("Ссылка создана", { type: "success" });
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) { showToast("Ошибка при создании ссылки", { type: "error" }); }
  };

  // inline rename file handler (used by tile inline editor)
  const handleInlineRenameFile = async (id, newBaseName) => {
    try {
      await dispatch(renameFileThunk({ id, name: newBaseName })).unwrap();
      showToast("Файл переименован", { type: "success" });
      setEditingFileId(null);
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) {
      showToast("Ошибка переименования", { type: "error" });
    }
  };

  // folder click & actions
  const handleFolderClick = (folder) => {
    const now = Date.now();
    if (lastClick.id === `folder-${folder.id}` && (now - lastClick.time) < 350) {
      openFolder(folder.id);
      setLastClick({ id: null, time: 0 });
      return;
    }
    setLastClick({ id: `folder-${folder.id}`, time: now });
    setSelectedFolder(folder);
    setSelectedFile(null);
  };

  const handleShareFolder = async (id) => {
    try {
      await dispatch(shareFolder({ id, action: "generate" })).unwrap();
      showToast("Ссылка на папку создана", { type: "success" });
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) { showToast("Ошибка при создании ссылки на папку", { type: "error" }); }
  };

  const handleDeleteFolder = async (id) => {
    if (!confirm("Удалить папку и всё её содержимое?")) return;
    try {
      await dispatch(deleteFolder({ id })).unwrap();
      setSelectedFolder(null);
      await dispatch(fetchFolders({ parent: currentFolder }));
      await dispatch(fetchFiles({ folder: currentFolder }));
      showToast("Папка удалена", { type: "success" });
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) { showToast("Ошибка удаления папки", { type: "error" }); }
  };

  const handleRenameFolder = async (id, newName) => {
    try {
      await dispatch(renameFolder({ id, name: newName })).unwrap();
      await dispatch(fetchFolders({ parent: folderParentId(localFolders.find(f=>f.id===id) || null) ?? null }));
      showToast("Папка переименована", { type: "success" });
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) { showToast("Ошибка переименования папки", { type: "error" }); }
  };

  // displayed lists
  const displayedFolders = (localFolders || []).filter(f => folderParentId(f) === currentFolder && (ownerMode ? true : (Number(ownerIdOfFolder(f)) === Number(user?.id))));
  const displayedFiles = (localFiles || []).filter(fi => fileFolderId(fi) === currentFolder);

  // download folder helper
  const handleDownloadFolder = async (id) => {
    try {
      const a = document.createElement("a");
      a.href = `/api/folders/${id}/download_zip/`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { showToast("Ошибка скачивания папки", { type: "error" }); }
  };

  return (
    <div className="container mx-auto p-6">
      <div style={{display:"flex", gap:20}}>
        {/* LEFT: folder tree */}
        <aside style={{width:300}}>
          <div className="card p-3">
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <strong>Папки</strong>
              <div style={{fontSize:12, color:"#6b7280"}}>{visibleFolders.filter(f=>folderParentId(f)===null).length} в корне</div>
            </div>

            <div style={{marginTop:12}}>
              <FolderTree
                folders={visibleFolders}
                currentFolder={currentFolder}
                onOpen={(id)=> openFolder(id)}
                onSelect={(node)=> handleFolderClick(node)}
              />
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{flex:1}}>
          <div className="card p-4">
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
              <div>
                <strong>Файлы</strong>
                <div style={{fontSize:12, color:"#6b7280"}}>{displayedFolders.length} папок, {displayedFiles.length} файлов</div>
              </div>

              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                {!ownerMode && (
                  <>
                    <input ref={fileInputRef} id="file-input" type="file" style={{display:"none"}} onChange={handleFileSelected} />
                    <label htmlFor="file-input" className="btn btn-primary" style={{cursor:"pointer"}}>Загрузить</label>
                    <input placeholder="Комментарий" value={uploadComment} onChange={e=>setUploadComment(e.target.value)} className="border p-2 rounded" />
                  </>
                )}
                <button className="btn" onClick={openRoot}>В корень</button>
              </div>
            </div>

            <div style={{minHeight:200, display:"flex", gap:12, flexWrap:"wrap"}}>
              {!ownerMode && <div style={{width:140}}><CreateFolderTile parent={currentFolder} /></div>}
              {displayedFolders.map(folder => (
                <div key={folder.id} onClick={()=>handleFolderClick(folder)} onDoubleClick={()=>openFolder(folder.id)}
                     style={{width:140, height:120, borderRadius:10, padding:10, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer"}}>
                  <div style={{fontSize:36}}>📁</div>
                  <div style={{marginTop:8, fontWeight:600, textAlign:"center", wordBreak:"break-word"}}>{folder.name}</div>
                  <div style={{fontSize:12, color:"#6b7280"}}>{(folderFilesCount[folder.id] || 0)} файлов</div>
                </div>
              ))}

              {displayedFiles.length === 0 && (<div className="text-gray-500">Нет файлов</div>)}
              {displayedFiles.map(file => {
                const idx = file.original_name ? file.original_name.lastIndexOf(".") : -1;
                const base = idx > 0 ? file.original_name.slice(0, idx) : file.original_name;
                const ext = idx > 0 ? file.original_name.slice(idx) : "";
                return (
                  <div key={file.id} style={{width:140, height:120, padding:10, borderRadius:10, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer"}}>
                    <div onClick={()=>handleFileClick(file)} onDoubleClick={()=>handleFileOpen(file)} style={{textAlign:"center", width:"100%"}}>
                      <div style={{fontSize:28}}>📄</div>
                      {!editingFileId || editingFileId !== file.id ? (
                        <>
                          <div style={{marginTop:8, fontWeight:600, textAlign:"center", wordBreak:"break-word"}} onDoubleClick={()=> { setEditingFileId(file.id); }}>
                            {file.original_name}
                          </div>
                          <div style={{fontSize:12, color:"#6b7280"}}>{formatBytes(file.size)}</div>
                        </>
                      ) : (
                        // inline rename input (edits base name only)
                        <InlineRename
                          file={file}
                          currentBase={base}
                          ext={ext}
                          onCancel={()=> setEditingFileId(null)}
                          onSave={async (newBase) => {
                            await handleInlineRenameFile(file.id, newBase);
                            setEditingFileId(null);
                          }}
                        />
                      )}
                    </div>

                    <div style={{marginTop:6, display:"flex", gap:6}}>
                      <button className="btn" onClick={()=> setSelectedFile(file)}>Открыть</button>
                      <button className="btn" onClick={()=> handleDeleteFile(file.id)}>Удалить</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {uploadProgress && (
              <div style={{marginTop:12}}>
                <div style={{fontSize:13}}>{uploadProgress.name}</div>
                <div style={{height:10, background:"#eee", borderRadius:6, overflow:"hidden", marginTop:6}}>
                  <div style={{width:`${uploadProgress.percent}%`, height:"100%", background:"linear-gradient(90deg,#06b6d4,#10b981)"}} />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* DETAILS */}
      {selectedFile && (
        <FileDetails
          file={selectedFile}
          onClose={async ()=> {
            setSelectedFile(null);
            window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
          }}
          onDelete={(id)=> handleDeleteFile(id)}
          onShare={(id)=> handleShareFile(id)}
        />
      )}

      {selectedFolder && (
        <div className="card p-4" style={{position:"fixed", right:20, bottom:20, width:"min(720px, 42vw)", maxWidth:"90vw"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div style={{flex:1, paddingRight:8}}>
              <div style={{fontWeight:700, wordBreak:"break-word"}}>{selectedFolder.name}</div>
              <div style={{fontSize:12, color:"#6b7280"}}>{(folderChildrenCount[selectedFolder.id]||0)} папок, {(folderFilesCount[selectedFolder.id]||0)} файлов</div>
            </div>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              <button className="btn" onClick={()=> handleDownloadFolder(selectedFolder.id)}>Скачать ZIP</button>
              <button className="btn" onClick={()=> handleShareFolder(selectedFolder.id)}>Поделиться</button>
              {!ownerMode && <button className="btn" onClick={()=> openFolder(selectedFolder.id)}>Открыть</button>}
            </div>
          </div>

          <div style={{marginTop:12, display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap"}}>
            {!ownerMode && <button className="btn" onClick={async ()=> {
              const name = prompt("Новое имя папки", selectedFolder.name);
              if (name) await handleRenameFolder(selectedFolder.id, name);
            }}>Переименовать</button>}
            {!ownerMode && <button className="btn btn-danger" onClick={()=> handleDeleteFolder(selectedFolder.id)}>Удалить</button>}
            <button className="btn" onClick={()=> setSelectedFolder(null)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* InlineRename component used inside the grid tile */
function InlineRename({ file, currentBase, ext, onCancel, onSave }) {
  const [val, setVal] = useState(currentBase || "");
  return (
    <div style={{display:"flex", flexDirection:"column", gap:6, alignItems:"center"}}>
      <input value={val} onChange={(e)=> setVal(e.target.value)} style={{width:"100%", boxSizing:"border-box"}} />
      <div style={{display:"flex", gap:6}}>
        <button className="btn" onClick={()=> { const clean = String(val||"").trim(); if (clean) onSave(clean); else alert("Имя не может быть пустым"); }}>OK</button>
        <button className="btn" onClick={onCancel}>Отмена</button>
      </div>
      <div style={{fontSize:12, color:"#6b7280"}}>Расширение: {ext || "(нет)"}</div>
    </div>
  );
}
