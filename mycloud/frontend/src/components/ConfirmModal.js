// frontend/src/components/ConfirmModal.js
import React from 'react';

export default function ConfirmModal({open, title, text, onCancel, onConfirm}) {
  if(!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{marginTop:0}}>{title || 'Confirm'}</h3>
        <p>{text}</p>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
          <button className="btn ghost" onClick={onCancel || (() => {})}>Cancel</button>
          <button className="btn danger" onClick={onConfirm || (() => {})}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
