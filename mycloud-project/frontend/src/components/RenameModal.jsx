import React, { useState, useEffect } from "react";

export default function RenameModal({ target, onClose, onConfirm, file }) {
  const [base, setBase] = useState("");
  const [ext, setExt] = useState("");

  useEffect(() => {
    if (file && file.original_name) {
      const idx = file.original_name.lastIndexOf(".");
      if (idx > 0) {
        setBase(file.original_name.slice(0, idx));
        setExt(file.original_name.slice(idx));
      } else {
        setBase(file.original_name);
        setExt("");
      }
    } else {}
  }, [file]);

  const submit = () => {
    const newName = ext ? base + ext : base;
    onConfirm(newName);
  };

  return (
    <div style={{position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.4)"}}>
      <div style={{background:"#fff", padding:20, borderRadius:8, width:420}}>
        <h3 className="font-semibold">Переименовать</h3>
        <div style={{marginTop:12}}>
          <label className="text-sm">Имя</label>
          <div style={{display:"flex", gap:6, marginTop:6}}>
            <input value={base} onChange={(e)=>setBase(e.target.value)} className="border p-2 rounded" style={{flex:1}} />
            <div style={{alignSelf:"center", minWidth:80, textAlign:"left"}}>{ext}</div>
          </div>
        </div>

        <div style={{display:"flex", justifyContent:"flex-end", gap:8, marginTop:14}}>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={submit}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
