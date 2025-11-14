import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchFiles,
  uploadFile as uploadFileThunk,
  deleteFile,
  downloadFile,
  shareFile,
  renameFile as renameFileThunk,
  moveFile
} from "../features/filesSlice";
import {
  fetchFolders,
  fetchFolderTree,
  createFolder,
  deleteFolder,
  renameFolder,
  shareFolder,
  moveFolder
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

function handleFolderSelect(folder) {
  // Just select the folder, don't navigate
  setSelectedFolder(folder);
  setSelectedFile(null);
}

export default function FileManager() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const query = useQuery();
  const ownerParam = query.get("owner");
  const ownerMode = ownerParam ? Number(ownerParam) : null;

  const user = useSelector((s) => s.auth.user);
  const filesState = useSelector((s) => s.files);
  const foldersState = useSelector((s) => s.folders);
  const folderTree = useSelector((s) => s.folders.tree);

  const [localFiles, setLocalFiles] = useState([]);
  const [localFolders, setLocalFolders] = useState([]);
  const [rootFiles, setRootFiles] = useState([]);
  const [rootFolders, setRootFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [uploadComment, setUploadComment] = useState("");
  const fileInputRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [editingFileId, setEditingFileId] = useState(null);

  const [folderFilesCount, setFolderFilesCount] = useState({});
  const [folderChildrenCount, setFolderChildrenCount] = useState({});

  const [dragOver, setDragOver] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (!ownerMode) {
          await dispatch(fetchCurrentUser()).unwrap();
        }
      } catch (e) {}

      if (ownerMode) {
        try {
          const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/`);
          setLocalFiles(storage.files || []);
          setLocalFolders(storage.folders || []);
          setRootFiles(storage.files || []);
          setRootFolders(storage.folders || []);
        } catch (err) {
          showToast("Не удалось загрузить хранилище пользователя", { type: "error" });
        }
      } else {
        try { await dispatch(fetchFiles({ folder: null })).unwrap(); } catch (e) {}
        try { await dispatch(fetchFolders({ parent: null })).unwrap(); } catch (e) {}
        try { await dispatch(fetchFolderTree()).unwrap(); } catch (e) {}
      }
    };
    init();
  }, [dispatch, ownerMode]);

  useEffect(() => {
    if (!ownerMode) {
      setLocalFiles(filesState.items || []);
      setLocalFolders(foldersState.list || []);
      if (currentFolder === null) {
        setRootFiles(filesState.items || []);
        setRootFolders(foldersState.list || []);
      }
    }
  }, [filesState.items, foldersState.list, ownerMode, currentFolder]);

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

  useEffect(() => {
    const onChange = async () => {
      if (ownerMode) {
        try {
          const storage = await apiFetch(
            `/api/admin-users/${ownerMode}/storage/?parent=${currentFolder ?? ""}`
          );
          setLocalFiles(storage.files || []);
          setLocalFolders(storage.folders || []);
        } catch (e) {
          /* intentionally ignore or log if you want */
        }
      } else {
        try {
          await dispatch(fetchFiles({ folder: currentFolder ?? null })).unwrap();
        } catch (e) { /* ignore */ }

        try {
          await dispatch(fetchFolders({ parent: currentFolder ?? null })).unwrap();
        } catch (e) { /* ignore */ }

        try {
          await dispatch(fetchCurrentUser()).unwrap();
        } catch (e) { /* ignore */ }
      }
    };

    window.addEventListener("mycloud:content-changed", onChange);
    return () => window.removeEventListener("mycloud:content-changed", onChange);
  }, [dispatch, ownerMode, currentFolder]);

  const visibleFolders = (localFolders || []).filter(f => {
    if (ownerMode) return true;
    if (!user) return false;
    const fid = ownerIdOfFolder(f);
    if (fid == null) return true;
    return Number(fid) === Number(user.id);
  });

  const openFolder = async (folderId) => {
    // Add current folder to history before changing
    setNavigationHistory(prev => [...prev, currentFolder]);
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
    setNavigationHistory([]); // Clear history when going to root
    setLocalFiles(rootFiles);
    setLocalFolders(rootFolders);
  };

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

  // DnD handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!ownerMode) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    
    if (ownerMode) {
      showToast("В режиме просмотра чужого хранилища загрузка запрещена", { type: "error" });
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      for (const file of files) {
        try {
          await uploadWithProgress(file);
          showToast(`Файл ${file.name} загружен`, { type: "success" });
        } catch (err) {
          showToast(`Ошибка при загрузке файла ${file.name}: ${err.message}`, { type: "error" });
        }
      }
      
      setUploadComment("");
      await dispatch(fetchFiles({ folder: currentFolder }));
      await dispatch(fetchCurrentUser());
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    }
  };

  // Internal DnD handlers
  const handleDragStart = (item, type) => (e) => {
    if (ownerMode) return;
    
    setDraggedItem({ ...item, type });
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: item.id,
      type: type,
      name: item.name || item.original_name
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragOver = (folderId) => (e) => {
    if (ownerMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFolderDrop = (targetFolderId) => async (e) => {
    if (ownerMode) return;
    e.preventDefault();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { id, type } = data;
      
      if (type === 'file') {
        await dispatch(moveFile({ id, folder: targetFolderId })).unwrap();
        showToast("Файл перемещён", { type: "success" });
      } else if (type === 'folder') {
        if (id === targetFolderId) {
          showToast("Нельзя переместить папку в саму себя", { type: "error" });
          return;
        }
        
        await dispatch(moveFolder({ id, parent: targetFolderId })).unwrap();
        showToast("Папка перемещена", { type: "success" });
      }
      
      await dispatch(fetchFiles({ folder: currentFolder }));
      await dispatch(fetchFolders({ parent: currentFolder }));
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
      
    } catch (err) {
      showToast("Ошибка перемещения", { type: "error" });
    }
    
    setDraggedItem(null);
  };

  const handleFileSelected = async (e) => {
    if (ownerMode) { showToast("В режиме просмотра чужого хранилища загрузка запрещена", { type: "error" }); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadWithProgress(file);
      setUploadComment("");
      await dispatch(fetchFiles({ folder: currentFolder }));
      await dispatch(fetchCurrentUser());
      showToast("Файл загружен", { type: "success" });
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) {
      showToast(err.message || "Ошибка при загрузке файла", { type: "error" });
    }
    e.target.value = "";
  };

  const [lastClick, setLastClick] = useState({ id: null, time: 0 });

  const handleFileClick = (file) => {
    const now = Date.now();
    if (lastClick.id === `file-${file.id}` && (now - lastClick.time) < 350) {
      // Double-click: open file details
      setSelectedFile(file);
      setSelectedFolder(null);
      setLastClick({ id: null, time: 0 });
      return;
    }
    setLastClick({ id: `file-${file.id}`, time: now });
    setSelectedFile(file);
    setSelectedFolder(null);
  };

  // Fixed download function
  const handleFileOpen = async (file) => {
    try {
      // Используем тот же подход, что и в FileDetails
      const downloadUrl = `/api/files/${file.id}/download/`;
      console.log("FileManager Download URL:", downloadUrl);

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.style.display = "none";
      a.setAttribute("download", file.original_name || "file");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Update selected file download stats immediately if it's the one being downloaded
      if (selectedFile && selectedFile.id === file.id) {
        setSelectedFile(prev => prev ? {
          ...prev,
          downloads_count: (prev.downloads_count || prev.download_count || 0) + 1,
          last_downloaded_at: new Date().toISOString()
        } : prev);
      }

      await dispatch(fetchCurrentUser());
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) {
      console.error("File open error:", err);
      showToast("Ошибка открытия файла", { type: "error" });
    }
  };

  const handleDeleteFile = async (id) => {
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

  const handleInlineRenameFile = async (id, newBaseName) => {
    try {
      await dispatch(renameFileThunk({ id, name: newBaseName })).unwrap();
      // Update selected file name immediately if it's the one being renamed
      if (selectedFile && selectedFile.id === id) {
        setSelectedFile(prev => prev ? { ...prev, original_name: newBaseName } : prev);
      }
      showToast("Файл переименован", { type: "success" });
      setEditingFileId(null);
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) {
      showToast("Ошибка переименования", { type: "error" });
    }
  };

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
      // Update selected folder name immediately if it's the one being renamed
      if (selectedFolder && selectedFolder.id === id) {
        setSelectedFolder(prev => prev ? { ...prev, name: newName } : prev);
      }
      showToast("Папка переименована", { type: "success" });
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (err) { showToast("Ошибка переименования папки", { type: "error" }); }
  };

  const displayedFolders = (localFolders || []).filter(f => folderParentId(f) === currentFolder && (ownerMode ? true : (Number(ownerIdOfFolder(f)) === Number(user?.id))));
  const displayedFiles = (localFiles || []).filter(fi => fileFolderId(fi) === currentFolder);

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
    <div 
      className="container mx-auto p-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={{display:"flex", gap:20}}>
        <aside style={{width:300}}>
          <div className="card p-3">
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <strong>Папки</strong>
            </div>

            <div style={{marginTop:12}}>
              <FolderTree
                folders={folderTree}
                currentFolder={currentFolder}
                onOpen={(id)=> openFolder(id)}
                onSelect={(node)=> {
                  // In folder tree, clicking should just select, not navigate
                  setSelectedFolder(node);
                  setSelectedFile(null);
                }}
                onDragOver={handleFolderDragOver}
                onDrop={handleFolderDrop}
              />
            </div>
          </div>
        </aside>

        <main 
          style={{
            flex:1, 
            border: dragOver ? '2px dashed #06b6d4' : 'none',
            borderRadius: dragOver ? '8px' : '0',
            padding: dragOver ? '8px' : '0',
            transition: 'all 0.2s',
            backgroundColor: dragOver ? '#f0f9ff' : 'transparent'
          }}
        >
          <div className="card p-4">
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
              <div>
                <strong>
                  {ownerMode ? `Хранилище пользователя (ID: ${ownerMode})` : 'Файлы'}
                </strong>
                <div style={{fontSize:12, color:"#6b7280"}}>
                  {ownerMode && ' (режим просмотра)'}
                </div>
              </div>

              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                {!ownerMode && (
                  <>
                    <input ref={fileInputRef} id="file-input" type="file" style={{display:"none"}} onChange={handleFileSelected} />
                    <label htmlFor="file-input" className="btn btn-primary" style={{cursor:"pointer"}}>Загрузить</label>
                    <input placeholder="Комментарий" value={uploadComment} onChange={e=>setUploadComment(e.target.value)} className="border p-2 rounded" />
                  </>
                )}
                {currentFolder && (
                  <button className="btn" onClick={() => {
                    // Go back using navigation history
                    if (navigationHistory.length > 0) {
                      const previousFolder = navigationHistory[navigationHistory.length - 1];
                      setNavigationHistory(prev => prev.slice(0, -1));
                      setCurrentFolder(previousFolder);
                      setSelectedFile(null);
                      setSelectedFolder(null);
                      // Load content for the previous folder
                      if (previousFolder) {
                        // Load content for the folder
                        const loadPreviousContent = async () => {
                          if (ownerMode) {
                            try {
                              const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/?parent=${previousFolder}`);
                              setLocalFiles(storage.files || []);
                              setLocalFolders(storage.folders || []);
                            } catch (e) {
                              console.error("Load previous content error", e);
                              showToast && showToast("Не удалось загрузить содержимое папки", { type: "error" });
                            }
                          } else {
                            try {
                              await dispatch(fetchFiles({ folder: previousFolder })).unwrap();
                              await dispatch(fetchFolders({ parent: previousFolder })).unwrap();
                            } catch (e) {
                              console.error("Load previous content error", e);
                              showToast && showToast("Не удалось загрузить содержимое папки", { type: "error" });
                            }
                          }
                        };
                        loadPreviousContent();
                      } else {
                        // Going back to root
                        setCurrentFolder(null);
                        if (ownerMode) {
                          // Reload root content for owner mode
                          const loadRootContent = async () => {
                            try {
                              const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/`);
                              setLocalFiles(storage.files || []);
                              setLocalFolders(storage.folders || []);
                              setRootFiles(storage.files || []);
                              setRootFolders(storage.folders || []);
                            } catch (e) {
                              console.error("Load root content error", e);
                              showToast && showToast("Не удалось загрузить корневую папку", { type: "error" });
                            }
                          };
                          loadRootContent();
                        } else {
                          // Reload root content for normal mode
                          const loadRootContent = async () => {
                            try {
                              await dispatch(fetchFiles({ folder: null })).unwrap();
                              await dispatch(fetchFolders({ parent: null })).unwrap();
                            } catch (e) {
                              console.error("Load root content error", e);
                              showToast && showToast("Не удалось загрузить корневую папку", { type: "error" });
                            }
                          };
                          loadRootContent();
                        }
                      }
                    } else {
                      // Fallback to root if no history
                      setCurrentFolder(null);
                      if (ownerMode) {
                        // Reload root content for owner mode
                        const loadRootContent = async () => {
                          try {
                            const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/`);
                            setLocalFiles(storage.files || []);
                            setLocalFolders(storage.folders || []);
                            setRootFiles(storage.files || []);
                            setRootFolders(storage.folders || []);
                          } catch (e) {
                            console.error("Load root content error", e);
                            showToast && showToast("Не удалось загрузить корневую папку", { type: "error" });
                          }
                        };
                        loadRootContent();
                      } else {
                        // Reload root content for normal mode
                        const loadRootContent = async () => {
                          try {
                            await dispatch(fetchFiles({ folder: null })).unwrap();
                            await dispatch(fetchFolders({ parent: null })).unwrap();
                          } catch (e) {
                            console.error("Load root content error", e);
                            showToast && showToast("Не удалось загрузить корневую папку", { type: "error" });
                          }
                        };
                        loadRootContent();
                      }
                    }
                  }}>
                    Назад
                  </button>
                )}
                <button className="btn" onClick={() => {
                  setCurrentFolder(null);
                  setNavigationHistory([]); // Clear history when going to root
                  setSelectedFile(null);
                  setSelectedFolder(null);
                  if (ownerMode) {
                    // Reload root content for owner mode
                    const loadRootContent = async () => {
                      try {
                        const storage = await apiFetch(`/api/admin-users/${ownerMode}/storage/`);
                        setLocalFiles(storage.files || []);
                        setLocalFolders(storage.folders || []);
                        setRootFiles(storage.files || []);
                        setRootFolders(storage.folders || []);
                      } catch (e) {
                        console.error("Load root content error", e);
                        showToast && showToast("Не удалось загрузить корневую папку", { type: "error" });
                      }
                    };
                    loadRootContent();
                  } else {
                    // Reload root content for normal mode
                    const loadRootContent = async () => {
                      try {
                        await dispatch(fetchFiles({ folder: null })).unwrap();
                        await dispatch(fetchFolders({ parent: null })).unwrap();
                      } catch (e) {
                        console.error("Load root content error", e);
                        showToast && showToast("Не удалось загрузить корневую папку", { type: "error" });
                      }
                    };
                    loadRootContent();
                  }
                }}>
                  В начало
                </button>
              </div>
            </div>

            <div style={{minHeight:200, display:"flex", gap:12, flexWrap:"wrap"}}>
              {!ownerMode && <div style={{width:140}}><CreateFolderTile parent={currentFolder} /></div>}
              
              {displayedFolders.map(folder => (
                <div 
                  key={folder.id} 
                  onClick={() => handleFolderClick(folder)} 
                  onDoubleClick={() => openFolder(folder.id)}
                  draggable={!ownerMode}
                  onDragStart={handleDragStart(folder, 'folder')}
                  onDragOver={handleFolderDragOver(folder.id)}
                  onDrop={handleFolderDrop(folder.id)}
                  style={{
                    width:140, 
                    height:120, 
                    borderRadius:10, 
                    padding:10, 
                    display:"flex", 
                    flexDirection:"column", 
                    alignItems:"center", 
                    justifyContent:"center", 
                    cursor:"pointer",
                    border: draggedItem?.id === folder.id ? '2px solid #06b6d4' : '1px solid #e6eef3',
                    opacity: draggedItem?.id === folder.id ? 0.6 : 1,
                    background: '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{fontSize:36}}>📁</div>
                  <div style={{marginTop:8, fontWeight:600, textAlign:"center", wordBreak:"break-word"}}>{folder.name}</div>
                  <div style={{fontSize:12, color:"#6b7280"}}></div>
                </div>
              ))}

              {displayedFiles.length === 0 && displayedFolders.length === 0 && (
                <div className="text-gray-500" style={{width: '100%', textAlign: 'center', padding: '40px'}}>
                  {ownerMode ? 'В этой папке нет файлов или папок' : 'Перетащите файлы сюда или нажмите "Загрузить"'}
                </div>
              )}
              
              {/* Files with proper DnD attributes */}
              {displayedFiles.map(file => {
                const idx = file.original_name ? file.original_name.lastIndexOf(".") : -1;
                const base = idx > 0 ? file.original_name.slice(0, idx) : file.original_name;
                const ext = idx > 0 ? file.original_name.slice(idx) : "";
                return (
                  <div
                    key={file.id}
                    draggable={!ownerMode}
                    onDragStart={handleDragStart(file, 'file')}
                    style={{
                      width:140,
                      height:120,
                      padding:10,
                      borderRadius:10,
                      display:"flex",
                      flexDirection:"column",
                      alignItems:"center",
                      justifyContent:"center",
                      cursor:"pointer",
                      border: draggedItem?.id === file.id ? '2px solid #06b6d4' : '1px solid #e6eef3',
                      opacity: draggedItem?.id === file.id ? 0.6 : 1,
                      background: '#fff',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div
                      onClick={() => handleFileClick(file)}
                      style={{textAlign:"center", width:"100%"}}
                    >
                      <div style={{fontSize:28}}>📄</div>
                      {!editingFileId || editingFileId !== file.id ? (
                        <>
                          <div
                            style={{marginTop:8, fontWeight:600, textAlign:"center", wordBreak:"break-word"}}
                          >
                            {file.original_name}
                          </div>
                          <div style={{fontSize:12, color:"#6b7280"}}>{formatBytes(file.size)}</div>
                        </>
                      ) : (
                        <InlineRename
                          file={file}
                          currentBase={base}
                          ext={ext}
                          onCancel={() => setEditingFileId(null)}
                          onSave={async (newBase) => {
                            await handleInlineRenameFile(file.id, newBase);
                            setEditingFileId(null);
                          }}
                        />
                      )}
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

      {selectedFile && (
        <FileDetails
          file={selectedFile}
          onClose={async ()=> {
            setSelectedFile(null);
            window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
          }}
          onDelete={ownerMode ? null : (id)=> handleDeleteFile(id)}
          onShare={ownerMode ? null : (id)=> handleShareFile(id)}
          readOnly={ownerMode}
        />
      )}

      {selectedFolder && (
        <div className="card p-4" style={{position:"fixed", right:20, bottom:20, width:"min(720px, 42vw)", maxWidth:"90vw"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <div style={{flex:1, paddingRight:8}}>
              <div style={{fontWeight:700, wordBreak:"break-word"}}>{selectedFolder.name}</div>
            </div>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              <button className="btn" onClick={()=> handleDownloadFolder(selectedFolder.id)}>Скачать ZIP</button>
              {!ownerMode && <button className="btn" onClick={()=> handleShareFolder(selectedFolder.id)}>Поделиться</button>}
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

function InlineRename({ file, currentBase, ext, onCancel, onSave }) {
  const [val, setVal] = useState(currentBase || "");
  return (
    <div style={{display:"flex", flexDirection:"column", gap:6, alignItems:"center"}}>
      <input 
        value={val} 
        onChange={(e)=> setVal(e.target.value)} 
        style={{width:"100%", boxSizing:"border-box", padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4}}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const clean = String(val||"").trim(); 
            if (clean) onSave(clean); 
            else alert("Имя не может быть пустым");
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
      />
      <div style={{display:"flex", gap:6}}>
        <button className="btn" onClick={()=> { 
          const clean = String(val||"").trim(); 
          if (clean) onSave(clean); 
          else alert("Имя не может быть пустым"); 
        }}>OK</button>
        <button className="btn" onClick={onCancel}>Отмена</button>
      </div>
      <div style={{fontSize:12, color:"#6b7280"}}>Расширение: {ext || "(нет)"}</div>
    </div>
  );
}


