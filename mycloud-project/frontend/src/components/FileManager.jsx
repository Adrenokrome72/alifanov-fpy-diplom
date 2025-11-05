// frontend/src/components/FileManager.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import apiFetch from "../api";
import formatBytes from "../utils/formatBytes";
import { showToast } from "../utils/toast";

/*
  FileManager: inline rename, create-folder-tile, upload-tile, drag&drop folders+files,
  optimistic updates, immediate recalc _items and used bytes.
*/

function splitExt(name = "") {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return [name, ""]; // no extension or hidden files like ".bashrc" treated as no ext
  const base = name.slice(0, idx);
  const ext = name.slice(idx + 1);
  return [base, ext];
}

function buildTree(folders) {
  const map = new Map();
  folders.forEach(f => map.set(f.id, { ...f, children: [] }));
  const roots = [];
  for (const f of map.values()) {
    if (f.parent == null) roots.push(f);
    else {
      const parent = map.get(f.parent);
      if (parent) parent.children.push(f);
      else roots.push(f);
    }
  }
  return roots;
}

function recomputeCounts(folders, files) {
  const fileCount = {};
  files.forEach(f => {
    const key = (f.folder === null || f.folder === undefined) ? "_root" : String(f.folder);
    fileCount[key] = (fileCount[key] || 0) + 1;
  });
  const subCount = {};
  folders.forEach(f => {
    const key = (f.parent === null || f.parent === undefined) ? "_root" : String(f.parent);
    subCount[key] = (subCount[key] || 0) + 1;
  });
  return folders.map(f => {
    const key = String(f.id);
    const filesHere = fileCount[key] || 0;
    const subHere = subCount[key] || 0;
    return { ...f, _items: filesHere + subHere };
  });
}

function computeUsedBytes(files) {
  return (files || []).reduce((s, f) => s + (Number(f.size || 0)), 0);
}

/* Presentational tiles */

// Folder tile (shows inline input when editing)
function FolderTile({ f, onSelect, onDoubleClick, onDragStart, onDrop, selected, editing, onRenameSubmit, onRenameCancel }) {
  const isSelected = selected && selected.type === "folder" && selected.id === f.id;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, f)}
      onClick={() => onSelect({ type: "folder", id: f.id })}
      onDoubleClick={() => onDoubleClick(f.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, f.id)}
      style={{
        width: 160, padding: 12, borderRadius: 8,
        border: isSelected ? "2px solid #06b6d4" : "1px solid rgba(15,23,42,0.06)",
        background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8
      }}
    >
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📁</div>

      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); onRenameSubmit(e.target.elements["name"].value); }}>
          <input name="name" defaultValue={f.name} className="border p-1 rounded w-full" autoFocus onBlur={() => onRenameCancel()} />
        </form>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
          <div style={{ fontSize: 12, color: "#666" }}>{(f._items ?? 0)} items</div>
        </>
      )}
    </div>
  );
}

// File tile (inline rename for base name only)
function FileTile({ item, onSelect, onDoubleClick, onDragStart, selected, editing, onRenameSubmit, onRenameCancel }) {
  const isSelected = selected && selected.type === "file" && selected.id === item.id;
  const [base, ext] = splitExt(item.original_name || item.name || "");
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDoubleClick={() => onDoubleClick(item)}
      onClick={() => onSelect({ type: "file", id: item.id })}
      style={{
        width: 160, padding: 12, borderRadius: 8,
        border: isSelected ? "2px solid #06b6d4" : "1px solid rgba(15,23,42,0.06)",
        background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8
      }}
    >
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📄</div>

      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); const value = e.target.elements["name"].value.trim(); onRenameSubmit(value ? `${value}${ext ? "."+ext : ""}` : null); }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input name="name" defaultValue={base} className="border p-1 rounded" autoFocus onBlur={() => onRenameCancel()} />
            <div style={{ alignSelf: "center", color: "#666" }}>.{ext}</div>
          </div>
        </form>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.original_name || item.name}</div>
          <div style={{ fontSize: 12, color: "#666" }}>{formatBytes(item.size)}</div>
        </>
      )}
    </div>
  );
}

/* Special tile: create folder (green +) */
function CreateFolderTile({ creating, onStartCreate, onCreateCancel, onCreateSubmit }) {
  return (
    <div style={{ width: 160, padding: 12, borderRadius: 8, border: "1px dashed rgba(15,23,42,0.06)", background: "#fafafa", cursor: "pointer" }}>
      {!creating ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 44 }}>📁</div>
          <button className="btn" onClick={onStartCreate} style={{ background: "#10b981", color: "#fff" }}>+ Папка</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); onCreateSubmit(e.target.elements["name"].value); }}>
          <input name="name" placeholder="Имя папки" className="border p-1 rounded w-full" autoFocus onBlur={onCreateCancel} />
        </form>
      )}
    </div>
  );
}

/* Special tile: upload */
function UploadTile({ onFileSelected }) {
  const fileRef = useRef();
  return (
    <div style={{ width: 160, padding: 12, borderRadius: 8, border: "1px dashed rgba(15,23,42,0.06)", background: "#fafafa", cursor: "pointer" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 44 }}>⬆️</div>
        <button className="btn" onClick={() => fileRef.current.click()}>Загрузить</button>
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => {
          const f = e.target.files[0];
          if (f) onFileSelected(f);
          e.target.value = null;
        }} />
      </div>
    </div>
  );
}

/* Tree node */
function TreeNode({ node, level = 0, expandedMap, toggle, onSelect, onDropFolder }) {
  const expanded = !!expandedMap[node.id];
  return (
    <div style={{ marginLeft: level * 12 }}>
      <div
        onClick={() => onSelect(node.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDropFolder(e, node.id)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: 6,
          borderRadius: 6, background: "#fff", cursor: "pointer"
        }}
      >
        {node.children && node.children.length > 0 && (
          <button onClick={(ev) => { ev.stopPropagation(); toggle(node.id); }} className="btn" style={{ width: 22, height: 22, padding: 0 }}>
            {expanded ? "▾" : "▸"}
          </button>
        )}
        <div style={{ fontWeight: 500 }}>{node.name}</div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>{node._items ?? 0} items</div>
      </div>
      {expanded && node.children && node.children.map(ch => (
        <TreeNode key={ch.id} node={ch} level={level + 1} expandedMap={expandedMap} toggle={toggle} onSelect={onSelect} onDropFolder={onDropFolder} />
      ))}
    </div>
  );
}

/* Main component */
export default function FileManager() {
  const [allFolders, setAllFolders] = useState([]);
  const [allFiles, setAllFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selected, setSelected] = useState(null); // {type,id}
  const [expandedMap, setExpandedMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editing, setEditing] = useState(null); // {type,id}

  const loadFolders = useCallback(async () => {
    try {
      const res = await apiFetch("/api/folders/");
      setAllFolders(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      showToast("Не удалось загрузить папки", { type: "error" });
    }
  }, []);

  const loadAllFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/files/");
      const arr = Array.isArray(res) ? res : [];
      setAllFiles(arr);
      const used = computeUsedBytes(arr);
      window.dispatchEvent(new CustomEvent("mycloud:usage", { detail: { used } }));
    } catch (err) {
      console.error(err);
      showToast("Не удалось загрузить файлы", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
    loadAllFiles();
  }, [loadFolders, loadAllFiles]);

  useEffect(() => {
    setAllFolders(prev => recomputeCounts(prev, allFiles));
  }, [allFiles]);

  // optimistic updates
  const localMoveFile = (fileId, newFolderId) => {
    setAllFiles(prev => {
      const next = prev.map(f => (f.id === fileId ? { ...f, folder: newFolderId } : f));
      setAllFolders(prevFolders => recomputeCounts(prevFolders, next));
      window.dispatchEvent(new CustomEvent("mycloud:usage", { detail: { used: computeUsedBytes(next) } }));
      return next;
    });
  };

  const localMoveFolder = (folderId, newParentId) => {
    setAllFolders(prev => {
      const nextRaw = prev.map(x => (x.id === folderId ? { ...x, parent: newParentId } : x));
      const next = recomputeCounts(nextRaw, allFiles);
      return next;
    });
  };

  const handleFileDragStart = (e, file) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "file", id: file.id }));
    e.dataTransfer.effectAllowed = "move";
  };
  const handleFolderDragStart = (e, folder) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "folder", id: folder.id }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnFolderTile = async (e, folderId) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (parsed.type === "file") {
      localMoveFile(parsed.id, folderId);
      try {
        await apiFetch(`/api/files/${parsed.id}/move/`, { method: "POST", body: { folder: folderId } });
        showToast("Файл перемещён", { type: "success" });
      } catch (err) {
        showToast("Ошибка при перемещении файла", { type: "error" });
        await loadAllFiles(); await loadFolders();
      }
    } else if (parsed.type === "folder") {
      if (parsed.id === folderId) { showToast("Нельзя переместить в саму себя", { type: "error" }); return; }
      localMoveFolder(parsed.id, folderId);
      try {
        await apiFetch(`/api/folders/${parsed.id}/move/`, { method: "POST", body: { parent: folderId } });
        showToast("Папка перемещена", { type: "success" });
      } catch (err) {
        showToast("Ошибка при перемещении папки", { type: "error" });
        await loadFolders(); await loadAllFiles();
      }
    }
  };

  const handleDropToRoot = async (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (parsed.type === "file") {
      localMoveFile(parsed.id, null);
      try {
        await apiFetch(`/api/files/${parsed.id}/move/`, { method: "POST", body: { folder: null } });
        showToast("Файл перемещён в корень", { type: "success" });
      } catch (err) {
        showToast("Ошибка при перемещении файла", { type: "error" });
        await loadAllFiles(); await loadFolders();
      }
    } else if (parsed.type === "folder") {
      localMoveFolder(parsed.id, null);
      try {
        await apiFetch(`/api/folders/${parsed.id}/move/`, { method: "POST", body: { parent: null } });
        showToast("Папка перемещена в корень", { type: "success" });
      } catch (err) {
        showToast("Ошибка при перемещении папки", { type: "error" });
        await loadAllFiles(); await loadFolders();
      }
    }
  };

  const uploadFile = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    if (currentFolder !== null) fd.append("folder", currentFolder);
    try {
      const res = await apiFetch("/api/files/", { method: "POST", body: fd });
      if (res && res.id) {
        setAllFiles(prev => {
          const next = [res, ...prev];
          setAllFolders(prevFolders => recomputeCounts(prevFolders, next));
          window.dispatchEvent(new CustomEvent("mycloud:usage", { detail: { used: computeUsedBytes(next) } }));
          return next;
        });
      } else {
        await loadAllFiles(); await loadFolders();
      }
      showToast("Файл загружен", { type: "success" });
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка загрузки", { type: "error" });
    }
  };

  const createFolder = async (name) => {
    const nm = (name || "").trim();
    if (!nm) { showToast("Имя папки не задано", { type: "error" }); return; }
    try {
      const res = await apiFetch("/api/folders/", { method: "POST", body: { name: nm, parent: currentFolder } });
      if (res && res.id) {
        setAllFolders(prev => recomputeCounts([res, ...prev], allFiles));
      } else await loadFolders();
      setCreatingFolder(false);
      showToast("Папка создана", { type: "success" });
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка создания папки", { type: "error" });
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (!window.confirm("Удалить выбранный элемент?")) return;
    try {
      if (selected.type === "file") {
        await apiFetch(`/api/files/${selected.id}/`, { method: "DELETE" });
        setAllFiles(prev => {
          const next = prev.filter(x => x.id !== selected.id);
          setAllFolders(prevFolders => recomputeCounts(prevFolders, next));
          window.dispatchEvent(new CustomEvent("mycloud:usage", { detail: { used: computeUsedBytes(next) } }));
          return next;
        });
      } else {
        await apiFetch(`/api/folders/${selected.id}/`, { method: "DELETE" });
        await loadFolders(); await loadAllFiles();
      }
      setSelected(null);
      showToast("Удалено", { type: "success" });
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка при удалении", { type: "error" });
    }
  };

  // Inline rename: set editing to {type,id}, handle submit accordingly
  const startRename = (type, id) => { setEditing({ type, id }); setSelected({ type, id }); };
  const cancelRename = () => setEditing(null);

  const submitRename = async (type, id, newFullName) => {
    if (!newFullName) { cancelRename(); return; }
    try {
      if (type === "file") {
        // newFullName includes extension (we pass base + ext)
        await apiFetch(`/api/files/${id}/`, { method: "PATCH", body: { original_name: newFullName } });
        setAllFiles(prev => prev.map(f => f.id === id ? { ...f, original_name: newFullName } : f));
      } else {
        await apiFetch(`/api/folders/${id}/rename/`, { method: "POST", body: { name: newFullName } });
        setAllFolders(prev => prev.map(f => f.id === id ? { ...f, name: newFullName } : f));
      }
      showToast("Переименовано", { type: "success" });
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка при переименовании", { type: "error" });
      await loadFolders(); await loadAllFiles();
    } finally {
      setEditing(null);
    }
  };

  const shareSelected = async () => {
    if (!selected) return;
    try {
      if (selected.type === "file") {
        const r = await apiFetch(`/api/files/${selected.id}/share/`, { method: "POST" });
        window.prompt("Ссылка для шаринга:", r.share_url || r.url || "");
      } else {
        const r = await apiFetch(`/api/folders/${selected.id}/share/`, { method: "POST" }).catch(()=>null);
        if (r && (r.share_url || r.url)) window.prompt("Ссылка для шаринга:", r.share_url || r.url);
        else window.open(`/api/folders/${selected.id}/download_zip/`, "_blank");
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка создания ссылки", { type: "error" });
    }
  };

  const openFile = (file) => {
    if (!file) return;
    if (file.download_url) window.open(file.download_url, "_blank");
    else window.open(`/api/files/${file.id}/download/`, "_blank");
  };

  const filesInCurrent = allFiles.filter(f => {
    if (currentFolder === null) return f.folder === null || f.folder === undefined;
    return f.folder === currentFolder;
  });
  const childrenFolders = allFolders.filter(f => {
    if (currentFolder === null) return f.parent === null || f.parent === undefined;
    return f.parent === currentFolder;
  });

  const toggle = (id) => setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  const onDropFolderInTree = (e, folderId) => handleDropOnFolderTile(e, folderId);

  return (
    <div className="container mx-auto p-4">
      <div className="card mb-4">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="font-semibold">Файловый менеджер</div>
            <div className="text-xs text-gray-500">Папка: {currentFolder ? (allFolders.find(f => f.id === currentFolder)?.name || "…") : "Корневой каталог"}</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <UploadTile onFileSelected={(file) => uploadFile(file)} />
              <CreateFolderTile
                creating={creatingFolder}
                onStartCreate={() => setCreatingFolder(true)}
                onCreateCancel={() => setCreatingFolder(false)}
                onCreateSubmit={(name) => createFolder(name)}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18 }}>
        <aside>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Папки</div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToRoot}
              onClick={() => { setCurrentFolder(null); setSelected(null); }}
              style={{ padding: 6, borderRadius: 6, background: currentFolder === null ? "#eef2ff" : "transparent", cursor: "pointer" }}
            >
              Root ({allFiles.filter(f => f.folder === null || f.folder === undefined).length} files)
            </div>

            <div style={{ marginTop: 8 }}>
              {buildTree(allFolders).map(node => (
                <TreeNode key={node.id} node={node} expandedMap={expandedMap} toggle={toggle} onSelect={(id) => { setCurrentFolder(id); setSelected(null); }} onDropFolder={onDropFolderInTree} />
              ))}
            </div>
          </div>
        </aside>

        <section>
          <div className="card mb-3" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="font-semibold">Содержимое</div>
            <div>
              {selected && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => startRename(selected.type, selected.id)}>Переименовать</button>
                  <button className="btn" onClick={deleteSelected}>Удалить</button>
                  <button className="btn" onClick={shareSelected}>Поделиться</button>
                  {selected.type === "file" ? <button className="btn" onClick={() => window.open(`/api/files/${selected.id}/download/`, "_blank")}>Скачать</button> : <button className="btn" onClick={() => window.open(`/api/folders/${selected.id}/download_zip/`, "_blank")}>Скачать папку</button>}
                </div>
              )}
            </div>
          </div>

          {loading ? <div>Загрузка…</div> : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {childrenFolders.map(f => (
                  <div key={f.id}>
                    <FolderTile
                      f={f}
                      onSelect={(sel) => setSelected(sel)}
                      onDoubleClick={(id) => setCurrentFolder(id)}
                      onDragStart={handleFolderDragStart}
                      onDrop={handleDropOnFolderTile}
                      selected={selected}
                      editing={editing && editing.type === "folder" && editing.id === f.id}
                      onRenameSubmit={(value) => submitRename("folder", f.id, value)}
                      onRenameCancel={() => cancelRename()}
                    />
                  </div>
                ))}
              </div>

              <hr style={{ margin: "14px 0" }} />

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {filesInCurrent.length === 0 && <div className="text-gray-500">Файлов не найдено в текущей папке</div>}
                {filesInCurrent.map(file => (
                  <FileTile
                    key={file.id}
                    item={file}
                    onSelect={(sel) => setSelected(sel)}
                    onDoubleClick={(f) => openFile(f)}
                    onDragStart={handleFileDragStart}
                    selected={selected}
                    editing={editing && editing.type === "file" && editing.id === file.id}
                    onRenameSubmit={(value) => submitRename("file", file.id, value)}
                    onRenameCancel={() => cancelRename()}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
