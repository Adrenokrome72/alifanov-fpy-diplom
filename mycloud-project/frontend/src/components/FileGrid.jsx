import React from "react";
import formatBytes from "../utils/formatBytes";

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

export default function FileGrid({ folders = [], files = [], onOpenFolder, onOpenFile, onSelect, onDragStart, selected }) {
  return (
    <div>
      <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
        {folders.map(f => (
          <FileTile
            key={`folder-${f.id}`}
            item={f}
            kind="folder"
            onDoubleClick={() => onOpenFolder(f.id)}
            onClick={onSelect}
            selected={selected}
          />
        ))}
      </div>

      <hr style={{margin:"14px 0"}} />

      <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
        {files.map(f => (
          <FileTile
            key={`file-${f.id}`}
            item={f}
            kind="file"
            onDoubleClick={() => onOpenFile(f)}
            onClick={onSelect}
            onDragStart={onDragStart}
            selected={selected}
          />
        ))}
      </div>
    </div>
  );
}
