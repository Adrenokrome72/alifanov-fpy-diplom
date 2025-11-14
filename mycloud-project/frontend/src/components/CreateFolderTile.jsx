import React, { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createFolder } from '../features/foldersSlice';

export default function CreateFolderTile({ parent = null }) {
  const dispatch = useDispatch();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const inputRef = useRef(null);
  useEffect(()=> { if (creating) inputRef.current?.focus(); }, [creating]);

  const handleCreate = async () => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setCreating(false);
    try {
      await dispatch(createFolder({ name: trimmed, parent })).unwrap();
      setName('');
    } catch (e) {
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  return (
    <div className="folder-tile create" style={{width:140, height:120, border:'1px dashed #d1d5db', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', borderRadius:8, cursor:'pointer'}}>
      {!creating ? (
        <div style={{textAlign:'center'}} onClick={()=>setCreating(true)}>
          <div style={{fontSize:36, color:'#10b981'}}>📁</div>
          <div style={{marginTop:8, fontWeight:600, color:'#10b981'}}>Создать папку</div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <input ref={inputRef} value={name} onChange={e=>setName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Имя папки" className="border p-2 rounded" />
          <div style={{display:'flex', gap:8, justifyContent:'center'}}>
            <button onClick={handleCreate} className="btn btn-primary">Создать</button>
            <button onClick={()=>{ setCreating(false); setName(''); }} className="btn">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
