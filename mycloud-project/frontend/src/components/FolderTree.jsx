// frontend/src/components/FolderTree.jsx
import React from 'react';

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

function Node({ node, level=0, onOpen, onSelect, currentFolder, onDragOver, onDrop }) {
  const [collapsed, setCollapsed] = React.useState(false);
  
  const handleDragOver = (e) => {
    e.preventDefault();
    if (onDragOver) onDragOver(node.id);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (onDrop) onDrop(node.id);
  };

  return (
    <div style={{ paddingLeft: level * 12, marginBottom:6 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <button className="btn-min" onClick={(e)=>{ e.stopPropagation(); setCollapsed(c=>!c); }}>{collapsed ? "+" : "-"}</button>
        <div 
          style={{ cursor:"pointer", flex:1 }} 
          onClick={()=>onSelect(node)} 
          onDoubleClick={()=>onOpen(node.id)}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div style={{ fontWeight: currentFolder===node.id ? 700 : 500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{node.name}</div>
          { node.children && node.children.length>0 && <div style={{ fontSize:12, color:"#6b7280" }}>{node.children.length} подпапок</div> }
        </div>
      </div>
      {!collapsed && node.children && node.children.map(c => (
        <Node 
          key={c.id} 
          node={c} 
          level={level+1} 
          onOpen={onOpen} 
          onSelect={onSelect} 
          currentFolder={currentFolder}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}

// Основной компонент дерева папок для FileManager
const FolderTree = ({ folders, currentFolder, onOpen, onSelect, onDragOver, onDrop }) => {
  const treeData = buildTree(folders || []);

  const handleRootDragOver = (e) => {
    e.preventDefault();
    if (onDragOver) onDragOver(null);
  };

  const handleRootDrop = (e) => {
    e.preventDefault();
    if (onDrop) onDrop(null);
  };

  return (
    <div onDragOver={handleRootDragOver} onDrop={handleRootDrop}>
      {treeData.map(node => (
        <Node 
          key={node.id} 
          node={node} 
          onOpen={onOpen} 
          onSelect={onSelect} 
          currentFolder={currentFolder}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
};

export default FolderTree;