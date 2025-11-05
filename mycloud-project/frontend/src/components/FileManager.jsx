// frontend/src/components/FileManager.jsx
import React, { useEffect, useState, useCallback } from "react";
import apiFetch from "../api";
import formatBytes from "../utils/formatBytes";
import { showToast } from "../utils/toast";

/* helpers */
const DEFAULT_QUOTA = 10 * 1024 * 1024 * 1024; // 10 GB

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

/* Tree node (supports drop) */
function TreeNode({ node, level = 0, expandedMap, toggle, onSelect, dragOverTarget, setDragOverTarget, currentFolderId }) {
  const expanded = expandedMap[node.id];
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOverTarget(null);
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === "file") {
        window.dispatchEvent(new CustomEvent("mycloud:dropfile", { detail: { fileId: parsed.id, folderId: node.id } }));
      }
    } catch (err) {}
  };
  return (
    <div style={{ marginLeft: level * 12 }}>
      <div
        onClick={() => onSelect(node.id)}
        onDragOver={(e)=>{ e.preventDefault(); setDragOverTarget(node.id); }}
        onDragEnter={(e)=>{ e.preventDefault(); setDragOverTarget(node.id); }}
        onDragLeave={() => setDragOverTarget(null)}
        onDrop={handleDrop}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 6,
          borderRadius: 6,
          background: currentFolderId === node.id ? "#eef2ff" : dragOverTarget === node.id ? "#f0f9ff" : "transparent",
          cursor: "pointer"
        }}
      >
        {node.children && node.children.length > 0 && (
          <button onClick={(e) => { e.stopPropagation(); toggle(node.id); }} className="btn" style={{width:22, height:22, padding:0}}>
            {expanded ? "▾" : "▸"}
          </button>
        )}
        <div style={{ fontWeight: 500 }}>{node.name}</div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>{node._items ?? 0} items</div>
      </div>

      {expanded && node.children && node.children.map(ch => (
        <TreeNode
          key={ch.id}
          node={ch}
          level={level+1}
          expandedMap={expandedMap}
          toggle={toggle}
          onSelect={onSelect}
          dragOverTarget={dragOverTarget}
          setDragOverTarget={setDragOverTarget}
          currentFolderId={currentFolderId}
        />
      ))}
    </div>
  );
}

/* File tile */
function FileTile({ item, kind, onDoubleClick, onClick, onDragStart, selected }) {
  const isSelected = selected && selected.type === kind && selected.id === item.id;
  const ext = item.original_name ? item.original_name.split(".").pop() : "";
  return (
    <div
      draggable={kind === "file"}
      onDragStart={kind==="file" ? onDragStart(item) : undefined}
      onDoubleClick={() => onDoubleClick(item)}
      onClick={() => onClick(kind, item.id)}
      style={{
        width:160,
        padding:12,
        borderRadius:8,
        border: isSelected ? "2px solid #06b6d4" : "1px solid rgba(15,23,42,0.06)",
        background: "#fff",
        cursor: "pointer",
        display:"flex",
        flexDirection:"column",
        gap:8
      }}
    >
      <div style={{height:64, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28}}>
        {kind==="folder" ? "📁" : "📄"}
      </div>
      <div style={{fontSize:14, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{item.name ?? item.original_name}</div>
      {kind==="file" && <div className="text-xs text-gray-500">{ext.toLowerCase()}</div>}
      {kind==="file" && <div className="text-xs text-gray-500">{formatBytes(item.size)}</div>}
    </div>
  );
}

/* Main component */
export default function FileManager() {
  const [allFolders, setAllFolders] = useState([]);
  const [allFiles, setAllFiles] = useState([]); // ALL files for user
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selected, setSelected] = useState(null);
  const [expandedMap, setExpandedMap] = useState({});
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const loadFolders = useCallback(async () => {
    try {
      const data = await apiFetch("/api/folders/");
      setAllFolders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось загрузить папки", { type: "error" });
    }
  }, []);

  const loadAllFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/files/"); // authenticated user -> returns their files
      const filesArr = Array.isArray(data) ? data : [];
      setAllFiles(filesArr);

      // compute usage
      const usedBytes = filesArr.reduce((s, f) => s + (Number(f.size || 0)), 0);
      // publish global event so NavBar can update even if backend doesn't maintain profile.used_bytes
      window.dispatchEvent(new CustomEvent("mycloud:usage", { detail: { used: usedBytes } }));

    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось загрузить файлы", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // initial loads
    loadFolders();
    loadAllFiles();
  }, [loadFolders, loadAllFiles]);

  // compute folder item counts (files + subfolders) whenever allFolders/allFiles changes
  useEffect(() => {
    // map folderId -> files count
    const fileCount = {};
    allFiles.forEach(f => {
      const key = f.folder == null ? "_root" : String(f.folder);
      fileCount[key] = (fileCount[key] || 0) + 1;
    });
    // map folderId -> subfolders count
    const subCount = {};
    allFolders.forEach(f => {
      const key = f.parent == null ? "_root" : String(f.parent);
      subCount[key] = (subCount[key] || 0) + 1;
    });

    // assign computed _items to folders in state copy
    setAllFolders(prev => prev.map(f => {
      const key = String(f.id);
      const filesHere = fileCount[key] || 0;
      const subHere = subCount[key] || 0;
      return { ...f, _items: filesHere + subHere };
    }));
  }, [allFiles, allFolders.length]); // depend on allFiles and length of allFolders (so after loadFolders we compute)

  // global drop handler (from tree nodes)
  useEffect(() => {
    const onDropFileEvent = async (e) => {
      const { fileId, folderId } = e.detail || {};
      if (!fileId) return;
      try {
        await apiFetch(`/api/files/${fileId}/move/`, { method: "POST", body: { folder: folderId } });
        showToast("Файл перемещён", { type: "success" });
        await loadAllFiles();
        await loadFolders();
      } catch (err) {
        console.error(err);
        showToast(err.message || "Не удалось переместить файл", { type: "error" });
      }
    };
    window.addEventListener("mycloud:dropfile", onDropFileEvent);
    return () => window.removeEventListener("mycloud:dropfile", onDropFileEvent);
  }, [loadAllFiles, loadFolders]);

  const toggle = (id) => setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));

  function breadcrumbs() {
    const trail = [];
    let cur = currentFolder ? allFolders.find(x => x.id === currentFolder) : null;
    while (cur) {
      trail.unshift(cur);
      cur = cur.parent ? allFolders.find(x => x.id === cur.parent) : null;
    }
    return trail;
  }

  // files filtered by currentFolder
  const filesInCurrent = allFiles.filter(f => {
    if (currentFolder === null) return !f.folder && f.folder != 0; // root => folder null/undefined
    return f.folder === currentFolder;
  });

  // UI actions

  const onUpload = async (ev) => {
    ev.preventDefault();
    const input = ev.target.elements["fileInput"];
    if (!input || !input.files || input.files.length === 0) {
      showToast("Выберите файл", { type: "error" });
      return;
    }
    const f = input.files[0];
    const form = new FormData();
    form.append("file", f);
    if (currentFolder !== null) form.append("folder", currentFolder);
    const commentEl = ev.target.elements["comment"];
    if (commentEl && commentEl.value) form.append("comment", commentEl.value);

    try {
      await apiFetch("/api/files/", { method: "POST", body: form });
      showToast("Файл загружен", { type: "success" });
      ev.target.reset();
      await loadAllFiles();
      await loadFolders();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка загрузки файла", { type: "error" });
    }
  };

  const createFolder = async () => {
    const name = (newFolderName || "").trim();
    if (!name) {
      showToast("Введите имя папки", { type: "error" });
      return;
    }
    try {
      await apiFetch("/api/folders/", { method: "POST", body: { name, parent: currentFolder } });
      showToast("Папка создана", { type: "success" });
      setNewFolderName("");
      await loadFolders();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка при создании папки", { type: "error" });
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    if (!window.confirm("Удалить выбранный объект?")) return;
    try {
      if (selected.type === "file") {
        await apiFetch(`/api/files/${selected.id}/`, { method: "DELETE" });
        showToast("Файл удалён", { type: "success" });
        await loadAllFiles();
      } else {
        await apiFetch(`/api/folders/${selected.id}/`, { method: "DELETE" });
        showToast("Папка удалена", { type: "success" });
        await loadFolders();
        await loadAllFiles();
      }
      setSelected(null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка удаления", { type: "error" });
    }
  };

  const onRename = () => {
    if (!selected) return;
    // show rename UI — implement modal or inline (left out here if you already have one)
    const newName = prompt("Новое имя:");
    if (!newName) return;
    (async () => {
      try {
        if (selected.type === "file") {
          try {
            await apiFetch(`/api/files/${selected.id}/rename/`, { method: "POST", body: { name: newName } });
          } catch (innerErr) {
            if (innerErr.status === 404 || innerErr.status === 400) {
              await apiFetch(`/api/files/${selected.id}/`, { method: "PATCH", body: { original_name: newName } });
            } else throw innerErr;
          }
          showToast("Файл переименован", { type: "success" });
          await loadAllFiles();
        } else {
          await apiFetch(`/api/folders/${selected.id}/rename/`, { method: "POST", body: { name: newName } });
          showToast("Папка переименована", { type: "success" });
          await loadFolders();
        }
        setSelected(null);
      } catch (err) {
        console.error(err);
        showToast(err.message || "Ошибка при переименовании", { type: "error" });
      }
    })();
  };

  const onShare = async () => {
    if (!selected) return;
    try {
      if (selected.type === "file") {
        const r = await apiFetch(`/api/files/${selected.id}/share/`, { method: "POST", body: { action: "generate" } });
        window.prompt("Ссылка (скопируйте):", r.share_url || r.url || "");
      } else {
        const r = await apiFetch(`/api/folders/${selected.id}/share/`, { method: "POST", body: { action: "generate" } }).catch(()=>null);
        if (r && (r.share_url || r.url)) {
          window.prompt("Ссылка (скопируйте):", r.share_url || r.url);
        } else {
          window.open(`/api/folders/${selected.id}/download_zip/`, "_blank");
        }
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка при создании ссылки", { type: "error" });
    }
  };

  const openFile = (file) => {
    if (!file) return;
    if (file.download_url) window.open(file.download_url, "_blank");
    else window.open(`/api/files/${file.id}/download/`, "_blank");
  };

  return (
    <div className="container mx-auto p-4">
      <div className="card mb-4">
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <div className="font-semibold">Файловый менеджер</div>
            <div className="text-xs text-gray-500">
              Папка: {breadcrumbs().length ? breadcrumbs().map(b => b.name).join(" / ") : "Root"}
            </div>
          </div>

          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            <form onSubmit={onUpload} style={{display:"flex", gap:8, alignItems:"center"}}>
              <input name="fileInput" type="file" />
              <input name="comment" placeholder="Комментарий" className="border p-1 rounded" />
              <button type="submit" className="btn btn-primary">Upload</button>
            </form>

            <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:12 }}>
              <input value={newFolderName} onChange={(e)=>setNewFolderName(e.target.value)} placeholder="Новая папка" className="border p-1 rounded" />
              <button className="btn" onClick={createFolder}>Create folder</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"300px 1fr", gap:18}}>
        <aside>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Папки</div>
            <div
              onDragOver={(e)=>e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const data = e.dataTransfer.getData("text/plain");
                if (!data) return;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === "file") {
                    await apiFetch(`/api/files/${parsed.id}/move/`, { method: "POST", body: { folder: null } });
                    showToast("Файл перемещён в root", { type: "success" });
                    await loadAllFiles();
                    await loadFolders();
                  }
                } catch (err) { console.error(err); showToast("Ошибка перемещения", { type: "error" }); }
              }}
              style={{ padding: 6, borderRadius: 6, background: currentFolder===null ? "#eef2ff" : "transparent", cursor: "pointer" }}
              onClick={() => { setCurrentFolder(null); setSelected(null); }}
            >
              Root ({allFiles.filter(f => !f.folder).length} files)
            </div>

            <div style={{ marginTop: 8 }}>
              {buildTree(allFolders).map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  expandedMap={expandedMap}
                  toggle={toggle}
                  onSelect={(id)=>{ setCurrentFolder(id); setSelected(null); }}
                  dragOverTarget={dragOverTarget}
                  setDragOverTarget={setDragOverTarget}
                  currentFolderId={currentFolder}
                />
              ))}
            </div>
          </div>
        </aside>

        <section>
          <div className="card mb-3" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div className="font-semibold">Содержимое</div>
            <div>
              {selected && (
                <div style={{display:"flex", gap:8}}>
                  <button className="btn" onClick={onRename}>Rename</button>
                  <button className="btn" onClick={onDelete}>Delete</button>
                  <button className="btn" onClick={onShare}>Share</button>
                  {selected.type==="file" && <button className="btn" onClick={() => openFile(allFiles.find(x => x.id===selected.id))}>Download</button>}
                  {selected.type==="folder" && <button className="btn" onClick={() => window.open(`/api/folders/${selected.id}/download_zip/`, "_blank")}>Download folder</button>}
                </div>
              )}
            </div>
          </div>

          {loading ? <div>Loading…</div> : (
            <>
              <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
                {allFolders.filter(f => (currentFolder === null ? (f.parent == null) : f.parent === currentFolder)).map(f => (
                  <div key={f.id} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{ e.preventDefault(); const d = e.dataTransfer.getData("text/plain"); try { const parsed = JSON.parse(d); if (parsed.type==="file") window.dispatchEvent(new CustomEvent("mycloud:dropfile",{ detail: { fileId: parsed.id, folderId: f.id } })); } catch(e){}}}
                       onClick={() => setSelected({ type: "folder", id: f.id })}
                       onDoubleClick={() => setCurrentFolder(f.id)}
                       style={{ width:160, padding:12, borderRadius:8, border: selected?.type==="folder" && selected?.id===f.id ? "2px solid #06b6d4" : "1px solid rgba(15,23,42,0.06)", background: "#fff", cursor: "pointer", display:"flex", flexDirection:"column", gap:8 }}
                  >
                    <div style={{height:64, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28}}>📁</div>
                    <div style={{fontSize:14, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{f.name}</div>
                    <div className="text-xs text-gray-500">{f._items ?? 0} items</div>
                  </div>
                ))}
              </div>

              <hr style={{margin:"14px 0"}} />

              <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
                {filesInCurrent.length === 0 && <div className="text-gray-500">Файлов не найдено в текущей папке</div>}
                {filesInCurrent.map(file => (
                  <FileTile key={file.id} item={file} kind="file"
                            onDoubleClick={() => openFile(file)}
                            onClick={() => setSelected({ type: "file", id: file.id })}
                            onDragStart={(f) => (ev) => { ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "file", id: f.id })); }}
                            selected={selected}
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
