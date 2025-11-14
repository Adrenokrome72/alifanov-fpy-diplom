import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import FolderTree from "./FolderTree";

let apiFetch;
try { apiFetch = require("../api").default || require("../api"); } catch (e) { apiFetch = window.apiFetch; }
let showToast;
try { showToast = require("../utils/toast").showToast || require("../utils/toast"); } catch (e) { showToast = window.showToast; }
let formatBytes;
try { formatBytes = require("../utils/formatBytes").default || require("../utils/formatBytes"); } catch (e) { formatBytes = window.formatBytes; }

function flattenTree(tree, result = []) {
  tree.forEach(node => {
    result.push({
      id: node.id,
      name: node.name,
      parent: node.parent,
      owner: node.owner,
      created_at: node.created_at,
      share_token: node.share_token,
      files_count: node.files_count,
      children_count: node.children_count
    });
    if (node.children && node.children.length > 0) {
      flattenTree(node.children, result);
    }
  });
  return result;
}

export default function AdminStorageView() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const routeUid = params?.userId ?? (location.state && location.state.user && (location.state.user.id ?? location.state.user.pk));
  const [uid] = useState(routeUid);

  const [allFolders, setAllFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [rootFiles, setRootFiles] = useState([]);
  const [rootFolders, setRootFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  const [allFoldersTree, setAllFoldersTree] = useState([]);
  const [navigationHistory, setNavigationHistory] = useState([]);

  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const treeRes = await apiFetch(`/api/admin-users/${uid}/folder_tree/`);
        const storageRes = await apiFetch(`/api/admin-users/${uid}/storage_tree/`);
        if (mounted) {
          setAllFoldersTree(flattenTree(treeRes || []));
          setRootFolders(storageRes.root_folders || []);
          setAllFolders(storageRes.root_folders || []);
          setRootFiles(storageRes.root_files || []);
          setFiles(storageRes.root_files || []);
          setUserInfo(storageRes.user_info || null);
          setCurrentFolder(null);
        }
      } catch (e) {
        console.error("AdminStorageView load error", e);
        showToast && showToast("Не удалось загрузить содержимое хранилища", { type: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [uid]);

  useEffect(() => {
    if (!uid || !currentFolder) return;
    const loadContent = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/admin-users/${uid}/folder_contents/?folder_id=${currentFolder.id}`);
        setFiles(res.files || []);
        setAllFolders(res.children || []);
      } catch (e) {
        console.error("Load content error", e);
        showToast && showToast("Не удалось загрузить содержимое папки", { type: "error" });
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, [currentFolder, uid]);

  useEffect(() => {
    const onChange = async () => {
      if (currentFolder) {
        try {
          const res = await apiFetch(`/api/admin-users/${uid}/folder_contents/?folder_id=${currentFolder.id}`);
          setFiles(res.files || []);
          setAllFolders(res.children || []);
        } catch (e) {
        }
      } else {
        try {
          const storageRes = await apiFetch(`/api/admin-users/${uid}/storage_tree/`);
          setRootFolders(storageRes.root_folders || []);
          setAllFolders(storageRes.root_folders || []);
          setRootFiles(storageRes.root_files || []);
          setFiles(storageRes.root_files || []);
        } catch (e) {
        }
      }
    };

    window.addEventListener("mycloud:content-changed", onChange);
    return () => window.removeEventListener("mycloud:content-changed", onChange);
  }, [uid, currentFolder]);

  const handleFolderSelect = (folder) => {
    setSelectedFolder(folder);
    setSelectedFile(null);
  };

  const handleFolderOpen = (folder) => {
    setCurrentFolder(folder);
    setSelectedFile(null);
    setSelectedFolder(null);
  };

  const handleBack = () => {
    if (navigationHistory.length > 0) {
      const previousFolder = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));
      setCurrentFolder(previousFolder);
      setSelectedFile(null);
      setSelectedFolder(null);
      if (previousFolder) {
        const loadPreviousContent = async () => {
          setLoading(true);
          try {
            const res = await apiFetch(`/api/admin-users/${uid}/folder_contents/?folder_id=${previousFolder.id}`);
            setFiles(res.files || []);
            setAllFolders(res.children || []);
          } catch (e) {
            console.error("Load previous content error", e);
            showToast && showToast("Не удалось загрузить содержимое папки", { type: "error" });
          } finally {
            setLoading(false);
          }
        };
        loadPreviousContent();
      } else {
        setAllFolders(rootFolders);
        setFiles(rootFiles);
      }
    } else {
      setCurrentFolder(null);
      setAllFolders(rootFolders);
      setFiles(rootFiles);
    }
  };

  const openFile = (file) => {
    try {
      const downloadUrl = `/api/files/${file.id}/download/`;
      console.log("AdminStorageView Download URL:", downloadUrl);

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.style.display = "none";
      a.setAttribute("download", file.original_name || "file");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (selectedFile && selectedFile.id === file.id) {
        setSelectedFile(prev => prev ? {
          ...prev,
          downloads_count: (prev.downloads_count || prev.download_count || 0) + 1,
          last_downloaded_at: new Date().toISOString()
        } : prev);
      }

      // Trigger content refresh to get updated stats from server
      window.dispatchEvent(new CustomEvent("mycloud:content-changed"));
    } catch (e) {
      console.error("Download error:", e);
      showToast && showToast("Ошибка скачивания", { type: "error" });
    }
  };

  const displayedFolders = allFolders.filter(f => !currentFolder || f.parent === currentFolder.id);
  const displayedFiles = currentFolder ? files : rootFiles;

  return (
    <div className="container" style={{ paddingTop: 18 }}>
      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Хранилище пользователя {userInfo?.full_name || uid}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 320px", gap: 16, marginTop: 12 }}>
          <aside className="folder-tree card" style={{ padding: 12, maxHeight: "70vh", overflow: "auto" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Папки</div>
            <div>
              <div
                className={`folder-item ${currentFolder === null ? "active" : ""}`}
                onClick={() => {
                  setCurrentFolder(null);
                  setNavigationHistory([]);
                  setFiles(rootFiles);
                  setAllFolders(rootFolders);
                }}
                style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid #eee" }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div className="icon">🏠</div>
                  <div>Корень</div>
                </div>
              </div>
              <FolderTree
                folders={allFoldersTree}
                currentFolder={currentFolder?.id}
                onSelect={handleFolderSelect}
                onOpen={handleFolderOpen}
              />
            </div>
          </aside>
          <main className="main">
            <div className="card" style={{ minHeight: 340 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>Файлы</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {currentFolder && (
                    <button className="btn" onClick={handleBack}>
                      Назад
                    </button>
                  )}
                  <button className="btn" onClick={() => {
                    setCurrentFolder(null);
                    setNavigationHistory([]);
                    setFiles(rootFiles);
                    setAllFolders(rootFolders);
                  }}>
                    В начало
                  </button>
                  <div className="muted">{loading ? "Загрузка..." : ""}</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="file-grid">
                  {displayedFolders.map(folder => (
                    <div
                      key={folder.id}
                      className="file-tile"
                      onClick={() => handleFolderOpen(folder)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="file-icon">📁</div>
                      <div className="file-name" title={folder.name}>{folder.name}</div>
                    </div>
                  ))}
                  {displayedFiles.map(file => (
                    <div
                      key={file.id}
                      className={`file-tile ${selectedFile?.id === file.id ? "active" : ""}`}
                      onClick={() => setSelectedFile(file)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="file-icon">📄</div>
                      <div className="file-name" title={file.original_name}>{file.original_name}</div>
                      <div className="file-meta muted">{formatBytes ? formatBytes(file.size) : file.size}</div>
                    </div>
                  ))}
                  {displayedFolders.length === 0 && displayedFiles.length === 0 && (
                    <div className="muted">Папок и файлов нет</div>
                  )}
                </div>
              </div>
            </div>
          </main>
          <aside className="card" style={{ padding: 12, minHeight: 340, overflow: "auto" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Информация о файле</div>
            {selectedFile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div><b>Имя:</b> {selectedFile.original_name}</div>
                <div><b>Размер:</b> {formatBytes ? formatBytes(selectedFile.size) : selectedFile.size}</div>
                <div><b>Загружен:</b> {new Date(selectedFile.uploaded_at).toLocaleString()}</div>
                <div><b>Скачиваний</b> {selectedFile.downloads_count || selectedFile.download_count || 0} {selectedFile.last_downloaded_at ? ` (посл.: ${new Date(selectedFile.last_downloaded_at).toLocaleString()})` : ""}</div>
                <div><b>Последнее скачивание:</b> {selectedFile.last_downloaded_at ? new Date(selectedFile.last_downloaded_at).toLocaleString() : "-"}</div>
                <div><b>Комментарий:</b> {selectedFile.comment || "-"}</div>
              </div>
            ) : (
              <div className="muted">Выберите файл</div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
