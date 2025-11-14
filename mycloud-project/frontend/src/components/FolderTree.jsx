import React, { useMemo, useState, useEffect } from 'react';
import { useState as useLocalState } from 'react';

function normalizeId(v){ if (v===null || v===undefined) return null; return String(v); }

function buildTree(flat){
  const nodes = new Map();
  (flat||[]).forEach(f => {
    const id = normalizeId(f.id ?? f.pk ?? f.name);
    nodes.set(id, { ...f, id, children: [] });
  });
  const roots = [];
  nodes.forEach((node) => {
    const rawParent = node.parent ?? node.parent_id ?? null;
    const parentId = normalizeId(rawParent);
    if (!parentId || !nodes.has(parentId)) {
      roots.push(node);
    } else {
      const p = nodes.get(parentId);
      p.children = p.children || [];
      p.children.push(node);
    }
  });
  return roots;
}

function findPathTo(rootNodes, targetId){
  const path = [];
  function dfs(node, acc){
    if (!node) return false;
    const id = String(node.id);
    const newAcc = acc.concat([id]);
    if (id === targetId) { path.push(...newAcc); return true; }
    for (const c of node.children || []){
      if (dfs(c, newAcc)) return true;
    }
    return false;
  }
  for (const r of rootNodes){
    if (dfs(r, [])) break;
  }
  return path;
}

const TreeNode = ({node, level, onSelect, onOpen, currentFolder, expandedSet, toggleExpand, onDragOver, onDrop}) => {
  const id = String(node.id);
  const isActive = currentFolder && String(currentFolder) === id;
  const hasChildren = (node.children && node.children.length > 0);
  const isExpanded = expandedSet.has(id);

  const handleClick = () => {
    if (onSelect) onSelect(node);
  };

  return (
    <div style={{paddingLeft: level * 12, display: 'flex', flexDirection: 'column'}}>
      <div style={{display: 'flex', alignItems: 'center', gap:8}}>
        {hasChildren ? (
          <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(id)} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
            {isExpanded ? '−' : '+'}
          </button>
        ) : <div style={{width:28}} />}
        <div
          style={{flex:1, cursor:'pointer', display:'flex', alignItems:'center'}}
          onClick={handleClick}
          onDragOver={onDragOver ? (e) => onDragOver(id)(e) : undefined}
          onDrop={onDrop ? (e) => onDrop(id)(e) : undefined}
        >
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div>📁</div>
            <div style={{fontWeight: isActive ? 700 : 500, color: isActive ? undefined : '#111'}}>{node.name || node.title || node.id}</div>
          </div>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(ch => <TreeNode key={ch.id} node={ch} level={level+1} onSelect={onSelect} onOpen={onOpen} currentFolder={currentFolder} expandedSet={expandedSet} toggleExpand={toggleExpand} onDragOver={onDragOver} onDrop={onDrop} />)}
        </div>
      )}
    </div>
  );
};

export default function FolderTree({ folders = [], currentFolder = null, onSelect, onOpen, onDragOver, onDrop }){
  const tree = useMemo(() => buildTree(folders), [folders]);
  const [expandedSet, setExpandedSet] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      {tree.length === 0 ? <div className="muted">Папок нет</div> : tree.map(node => (
        <TreeNode key={node.id} node={node} level={0} onSelect={onSelect} onOpen={onOpen} currentFolder={currentFolder} expandedSet={expandedSet} toggleExpand={toggleExpand} onDragOver={onDragOver} onDrop={onDrop} />
      ))}
    </div>
  );
}
