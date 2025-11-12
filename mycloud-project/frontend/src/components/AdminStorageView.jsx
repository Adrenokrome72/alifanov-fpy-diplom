import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import FolderTree from "./FolderTree";
import FileDetails from "./FileDetails";
import CreateFolderTile from "./CreateFolderTile";
import apiFetch from "../api";
import { showToast } from "../utils/toast";
import formatBytes from "../utils/formatBytes";

export default function AdminStorageView() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const routeUid = params?.uid ?? (location.state && location.state.user && (location.state.user.id ?? location.state.user.pk));
  const [uid] = useState(routeUid);

  const [foldersAll, setFoldersAll] = useState([]); // static tree
  const [currentFolder, setCurrentFolder] = useState(null); // currently viewed folder id
  const [displayFolders, setDisplayFolders] = useState([]); // folders for currentFolder (children)
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // load full folder tree initially (if API provides)
  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    const loadAll = async () => {
      try {
        const res = await apiFetch(`/api/admin-users/${uid}/storage/`);
        // If API returns folders array representing full tree - use it as static tree
        const all = Array.isArray(res.folders) ? res.folders : (res.all_folders || []);
        if (mounted && all && all.length) setFoldersAll(all);
        // Also set display folders and files from response root
        const df = Array.isArray(res.folders) ? res.folders : (res.folders || []);
        const fs = Array.isArray(res.files) ? res.files : (res.files || []);
        if (mounted) {
          setDisplayFolders(df || []);
          setFiles(fs || []);
        }
      } catch (e) {
        console.error("AdminStorageView loadAll error", e);
        try { showToast && showToast("Не удалось загрузить хранилище пользователя", { type: "error" }); } catch {}
      }
    };
    loadAll();
    return () => { mounted = false; };
  }, [uid]);

  // load content for given parent folder (when navigating)
  const loadForFolder = async (parentId) => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin-users/${uid}/storage/?parent=${parentId ?? ""}`);
      const df = Array.isArray(res.folders) ? res.folders : (res.folders || []);
      const fs = Array.isArray(res.files) ? res.files : (res.files || []);
      setDisplayFolders(df || []);
      setFiles(fs || []);
      setSelectedFile(null);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      console.error("loadForFolder error", e);
      try { showToast && showToast("Не удалось загрузить содержимое папки", { type: "error" }); } catch {}
    }
  };

  // handle clicking folder in main area to drill into it
  const handleOpenFolder = (folder) => {
    const fid = folder.id ?? folder.pk ?? folder.name;
    setCurrentFolder(fid);
    loadForFolder(fid);
  };

  // navigate back to parent (find parent in foldersAll)
  const handleBack = () => {
    if (!currentFolder) return;
    const parent = (foldersAll || []).find(f => (f.id ?? f.pk) === currentFolder)?.parent ?? null;
    setCurrentFolder(parent || null);
    loadForFolder(parent || "");
  };

  const openFile = (file) => {
    if (!file) return;
    const url = file.download_url || file.url || file.preview_url || file.link;
    if (url) return window.open(url, "_blank", "noopener");
    try { showToast && showToast("Нет прямой ссылки на файл", { type: "error" }); } catch {}
  };

  return (
    <div className="app-shell">
      <div className="page container" role="main" style={{ paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Назад</button>
          <div style={{ fontWeight: 700 }}>{selectedFile ? selectedFile.name : `Хранилище пользователя ${uid ?? ""}`}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 360px", gap: 12 }}>
          <aside className="folder-tree card" aria-label="Folders" style={{ padding: 12, height: "min(70vh, 80vh)", overflow: "auto" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Папки</div>
            {/* Render static folder tree from foldersAll; highlight currentFolder */}
            <FolderTree
              folders={foldersAll.length ? foldersAll : displayFolders}
              onOpen={() => {}}
              onSelect={(f) => {
                // when selecting from tree, set currentFolder and load its children in main area
                const fid = f.id ?? f.pk ?? f.name;
                setCurrentFolder(fid);
                loadForFolder(fid);
              }}
              currentFolder={currentFolder}
            />
          </aside>

          <main className="main">
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>Файлы</div>
                <div className="muted">{loading ? "Загрузка..." : `${files.length} файлов`}</div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                  <button className="btn btn-primary" disabled>Загрузить</button>
                  <div style={{ marginLeft: "auto" }}>
                    <button className="btn btn-ghost" onClick={handleBack} disabled={!currentFolder}>Назад</button>
                  </div>
                </div>

                <div className="file-grid">
                  {/* include CreateFolderTile visually but disabled */}
                  <CreateFolderTile readOnly />

                  {files && files.length ? files.map(file => {
                    const fid = file.id ?? file.pk ?? file.name;
                    return (
                      <div key={fid} className="file-tile">
                        <div className="file-icon">📄</div>
                        <div className="file-name" title={file.name}>{file.name}</div>
                        <div className="file-meta muted">{typeof formatBytes === "function" ? formatBytes(file.size) : file.size}</div>

                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openFile(file)}>Открыть</button>
                          <button className="btn btn-ghost btn-sm" disabled>Удалить</button>
                          <button className="btn btn-ghost btn-sm" disabled>Переименовать</button>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="card p-3 center">Файлов нет</div>
                  )}
                </div>
              </div>
            </div>
          </main>

          <aside className="card" style={{ padding: 12, minHeight: 120, maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Информация о файле</div>
            <FileDetails file={selectedFile} onClose={() => setSelectedFile(null)} readOnly={true} />
            {!selectedFile && <div className="muted">Выберите файл для просмотра</div>}
          </aside>
        </div>
      </div>
    </div>
  );
}
