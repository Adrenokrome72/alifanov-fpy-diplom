// frontend/src/components/FolderTree.jsx
import React from 'react';

/*
  FolderTree: принимает уже отфильтрованный массив папок (т.е. фильтрация по владельцу делается снаружи).
  props:
    - folders: flat array [{id,name,parent,owner,...}]
    - currentFolder: id|null
    - onOpen(id) - двойной клик открыть
    - onSelect(node) - один клик выбрать
*/
function buildTree(flat) {
  const map = new Map();
  flat.forEach(f => map.set(f.id, { ...f, children: [] }));
  const roots = [];
  map.forEach(node => {
    if (node.parent == null) roots.push(node);
    else {
      const p = map.get(node.parent);
      if (p) p.children.push(node);
      else roots.push(node);
    }
  });
  const sortRec = (nodes) => {
    nodes.sort((a,b)=>a.name.localeCompare(b.name));
    nodes.forEach(n=> sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function Node({ node, level=0, onOpen, onSelect, currentFolder }) {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <div style={{ paddingLeft: level * 12, marginBottom:6 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <button className="btn-min" onClick={(e)=>{ e.stopPropagation(); setCollapsed(c=>!c); }}>{collapsed ? "+" : "-"}</button>
        <div style={{ cursor:"pointer", flex:1 }} onClick={()=>onSelect(node)} onDoubleClick={()=>onOpen(node.id)}>
          <div style={{ fontWeight: currentFolder===node.id ? 700 : 500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{node.name}</div>
          { node.children && node.children.length>0 && <div style={{ fontSize:12, color:"#6b7280" }}>{node.children.length} подпапок</div> }
        </div>
      </div>
      {!collapsed && node.children && node.children.map(c => <Node key={c.id} node={c} level={level+1} onOpen={onOpen} onSelect={onSelect} currentFolder={currentFolder} />)}
    </div>
  );
}

export default function FolderTree({ folders = [], onOpen = ()=>{}, onSelect = ()=>{}, currentFolder = null }) {
  const tree = React.useMemo(()=> buildTree(folders || []), [folders]);
  return (
    <div>
      {tree.map(r => <Node key={r.id} node={r} onOpen={onOpen} onSelect={onSelect} currentFolder={currentFolder} />)}
    </div>
  );
}
