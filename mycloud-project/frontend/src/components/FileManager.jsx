// frontend/src/components/FileManager.jsx
import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchFiles,
  uploadFile,
  moveFile,
  deleteFile,
  downloadFile,
  shareFile,
} from "../features/filesSlice";
import {
  fetchFolders,
  createFolder,
  moveFolder,
  renameFolder,
  deleteFolder,
  shareFolder,
} from "../features/foldersSlice";
import { fetchCurrentUser } from "../features/authSlice";
import FileDetails from "./FileDetails";
import CreateFolderTile from "./CreateFolderTile";
import { showToast } from "../utils/toast";
import formatBytes from "../utils/formatBytes";
import apiFetch from "../api";
import { useLocation } from "react-router-dom";

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
  const query = useQuery();
  const ownerParam = query.get("owner");
  const ownerMode = ownerParam ? Number(ownerParam) : null;

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

  // counts maps (calculated client-side)
  const [folderFilesCount, setFolderFilesCount] = useState({});
  const [folderChildrenCount, setFolderChildrenCount] = useState({});

  // initial load
  useEffect(() => {
    const init = async () => {
      // load current user
      try { await dispatch(fetchCurrentUser()).unwrap(); } catch(e){/*ignore*/}

      if (ownerMode) {
        // admin view of other user's storage
        try {
          const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/`);
          setLocalFiles(storage.files || []);
          setLocalFolders(storage.folders || []);
        } catch (err) {
          showToast("Ошибка загрузки чужого хранилища", { type: "error" });
        }
      } else {
        // normal user
        try {
          const filesRes = await dispatch(fetchFiles({ folder: null })).unwrap();
        } catch (e) {}
        try {
          const foldersRes = await dispatch(fetchFolders({ parent: null })).unwrap();
        } catch (e) {}
        // set local copies from redux (if present)
        setLocalFiles(filesState.items || []);
        setLocalFolders(foldersState.list || []);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, ownerMode]);

  // keep local copies in sync when slices update
  useEffect(()=> {
    if (!ownerMode) {
      setLocalFiles(filesState.items || []);
      setLocalFolders(foldersState.list || []);
    }
  }, [filesState.items, foldersState.list, ownerMode]);

  // recalc counts whenever lists change
  useEffect(()=> {
    const fcount = {};
    const children = {};
    const allFiles = localFiles || [];
    const allFolders = localFolders || [];

    allFiles.forEach(file => {
      const fid = fileFolderId(file) ?? null;
      fcount[fid] = (fcount[fid] || 0) + 1;
    });
    allFolders.forEach(folder => {
      const pid = folderParentId(folder);
      children[pid] = (children[pid] || 0) + 1;
    });
    setFolderFilesCount(fcount);
    setFolderChildrenCount(children);
  }, [localFiles, localFolders]);

  // helper: list of folders visible in tree — filter to current user unless admin / ownerMode
  const visibleFolders = (localFolders || []).filter(f => {
    if (ownerMode) return true; // viewing someone else's storage should show all for that owner
    if (!user) return false;
    if (user.is_staff) return true; // admins see all
    const fid = ownerIdOfFolder(f);
    // if owner field missing, assume it's current user's
    if (fid == null) return true;
    return fid === user.id;
  });

  const rootNodes = visibleFolders.filter(f => folderParentId(f) === null);

  // helpers to load children from server when expanding/opening folder
  const openFolder = async (folderId) => {
    setCurrentFolder(folderId);
    setSelectedFile(null);
    setSelectedFolder(null);
    if (ownerMode) {
      // admin viewing: call admin storage with parent filter
      try {
        const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/?parent=${folderId}`);
        setLocalFiles(storage.files || []);
        setLocalFolders(storage.folders || []);
      } catch (err) {
        showToast("Не удалось открыть папку", { type: "error" });
      }
    } else {
      try {
        await dispatch(fetchFiles({ folder: folderId })).unwrap();
        await dispatch(fetchFolders({ parent: folderId })).unwrap();
        // redux will populate lists -> effect will sync local lists
      } catch (err) {
        showToast("Ошибка получения содержимого папки", { type: "error" });
      }
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
      } catch (err) {
        showToast("Не удалось открыть корень", { type: "error" });
      }
    } else {
      try {
        await dispatch(fetchFiles({ folder: null })).unwrap();
        await dispatch(fetchFolders({ parent: null })).unwrap();
      } catch (err) {}
    }
  };

  // upload file - disabled in ownerMode
  const handleFileSelected = async (e) => {
    if (ownerMode) { showToast("В режиме просмотра чужого хранилища загрузка запрещена", { type: "error" }); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await dispatch(uploadFile({ file, folder: currentFolder, comment: uploadComment })).unwrap();
      setUploadComment("");
      // refresh
      await dispatch(fetchFiles({ folder: currentFolder }));
      await dispatch(fetchCurrentUser());
    } catch (err) {
      showToast("Ошибка при загрузке файла", { type: "error" });
    }
  };

  // file click/doubleclick
  const [lastClick, setLastClick] = useState({ id: null, time: 0 });
  const handleFileClick = (file) => {
    const now = Date.now();
    if (lastClick.id === file.id && (now - lastClick.time) < 350) {
      // double click -> open (download)
      handleFileOpen(file);
      setLastClick({ id: null, time: 0 });
      return;
    }
    setLastClick({ id: file.id, time: now });
    setSelectedFile(file);
    setSelectedFolder(null);
  };
  const handleFileOpen = async (file) => {
    try {
      await dispatch(downloadFile({ id: file.id })).unwrap();
      await dispatch(fetchFiles({ folder: currentFolder }));
      await dispatch(fetchCurrentUser());
    } catch (err) {
      showToast("Ошибка открытия файла", { type: "error" });
    }
  };

  const handleDeleteFile = async (id) => {
    if (!confirm("Удалить файл?")) return;
    try {
      await dispatch(deleteFile({ id })).unwrap();
      setSelectedFile(null);
      await dispatch(fetchFiles({ folder: currentFolder }));
      await dispatch(fetchCurrentUser());
    } catch (err) {
      showToast("Ошибка удаления", { type: "error" });
    }
  };

  // share file (use thunk; if backend 404 then inform user)
  const handleShareFile = async (id) => {
    try {
      await dispatch(shareFile({ id, action: "generate" })).unwrap();
    } catch (err) {
      showToast("Ошибка при создании ссылки (возможно, endpoint на сервере отсутствует)", { type: "error" });
    }
  };

  // folder selection
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

  // share folder: call foldersSlice.shareFolder
  const handleShareFolder = async (id) => {
    try {
      await dispatch(shareFolder({ id, action: "generate" })).unwrap();
    } catch (err) {
      showToast("Ошибка при создании ссылки на папку", { type: "error" });
    }
  };

  // download folder as zip
  const handleDownloadFolder = async (id) => {
    try {
      // try fetch blob
      const resp = await apiFetch(`/api/folders/${id}/download_zip/`);
      if (resp && resp.blob) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `folder-${id}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        // fallback: navigate
        window.location.href = `/api/folders/${id}/download_zip/`;
      }
    } catch (err) {
      showToast("Ошибка скачивания папки", { type: "error" });
    }
  };

  // move (drag/drop) handlers are kept as before — omitted for brevity in this file snippet — you have them earlier

  // Prepare displayed lists (only items inside currentFolder)
  const displayedFolders = (localFolders || []).filter(f => folderParentId(f) === currentFolder && (ownerMode ? true : (user?.is_staff ? true : ownerIdOfFolder(f) === user?.id)));
  const displayedFiles = (localFiles || []).filter(fi => fileFolderId(fi) === currentFolder);

  return (
    <div className="container mx-auto p-6">
      <div style={{display:"flex", gap:20}}>
        {/* LEFT */}
        <aside style={{width:300}}>
          <div className="card p-3">
            <div style={{display:"flex", justifyContent:"space-between"}}>
              <strong>Папки</strong>
              <div style={{fontSize:12, color:"#6b7280"}}>{(visibleFolders || []).filter(f=>folderParentId(f)===null).length} в корне</div>
            </div>

            <div style={{marginTop:12}}>
              <div style={{padding:6}} onDrop={()=>{}} onDragOver={(e)=>e.preventDefault()}>
                {rootNodes.map(r => (
                  <div key={r.id} style={{marginBottom:8}}>
                    <div style={{display:"flex", gap:8, alignItems:"center", cursor:"pointer", padding:6}} onClick={()=> handleFolderClick(r)}>
                      <div style={{fontSize:18}}>📁</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600}}>{r.name}</div>
                        <div style={{fontSize:12, color:"#6b7280"}}>
                          { (folderChildrenCount[r.id] || 0) } папок, { (folderFilesCount[r.id] || 0) } файлов
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{flex:1}}>
          <div className="card p-4">
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
              <div>
                <strong>Файлы</strong>
                <div style={{fontSize:12, color:"#6b7280"}}>{displayedFolders.length} папок, {displayedFiles.length} файлов в текущей папке</div>
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
                  <div style={{marginTop:8, fontWeight:600}}>{folder.name}</div>
                  <div style={{fontSize:12, color:"#6b7280"}}>{(folderFilesCount[folder.id] || 0)} файлов</div>
                </div>
              ))}

              {displayedFiles.length === 0 && (<div className="text-gray-500">Нет файлов</div>)}
              {displayedFiles.map(file => (
                <div key={file.id} onClick={()=>{ setSelectedFile(file); setSelectedFolder(null); }} onDoubleClick={()=>handleFileOpen(file)}
                     style={{width:140, height:120, padding:10, borderRadius:10, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer"}}>
                  <div style={{fontSize:28}}>📄</div>
                  <div style={{marginTop:8, fontWeight:600}}>{file.original_name}</div>
                  <div style={{fontSize:12, color:"#6b7280"}}>{formatBytes(file.size)}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* DETAILS: file or folder */}
      {selectedFile && (
        <FileDetails
          file={selectedFile}
          onClose={async ()=> {
            setSelectedFile(null);
            if (ownerMode) {
              const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/?parent=${currentFolder}`);
              setLocalFiles(storage.files || []);
              setLocalFolders(storage.folders || []);
            } else {
              await dispatch(fetchFiles({ folder: currentFolder }));
            }
            await dispatch(fetchCurrentUser());
          }}
          onDelete={handleDeleteFile}
          onShare={handleShareFile}
        />
      )}

      {selectedFolder && (
        <div className="card p-4" style={{position:"fixed", right:20, bottom:20, width:360}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700}}>{selectedFolder.name}</div>
              <div style={{fontSize:12, color:"#6b7280"}}>{(folderChildrenCount[selectedFolder.id]||0)} папок, {(folderFilesCount[selectedFolder.id]||0)} файлов</div>
            </div>
            <div style={{display:"flex", gap:8}}>
              <button className="btn" onClick={()=> handleDownloadFolder(selectedFolder.id)}>Скачать ZIP</button>
              <button className="btn" onClick={()=> handleShareFolder(selectedFolder.id)}>Поделиться</button>
              {!ownerMode && <button className="btn" onClick={()=> openFolder(selectedFolder.id)}>Открыть</button>}
            </div>
          </div>
          <div style={{marginTop:12}}>
            <button className="btn" onClick={()=> setSelectedFolder(null)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}
