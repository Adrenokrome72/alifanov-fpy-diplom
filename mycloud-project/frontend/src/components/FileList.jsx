// frontend/src/components/FileList.jsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { uploadFile, renameFile, shareFile, deleteFile } from '../features/filesSlice';

export default function FileList({ files = [], folderId = null, onRefresh, onRequestMove }) {
  const dispatch = useDispatch();
  const [selectedFile, setSelectedFile] = useState(null);
  const [comment, setComment] = useState('');
  const [sortBy, setSortBy] = useState('uploaded_at');
  const [order, setOrder] = useState('desc');

  const sorted = [...files].sort((a,b) => {
    let va = a[sortBy] || '', vb = b[sortBy] || '';
    if (sortBy === 'size') { va = a.size || 0; vb = b.size || 0; }
    if (order === 'asc') return va > vb ? 1 : va < vb ? -1 : 0;
    return va < vb ? 1 : va > vb ? -1 : 0;
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    await dispatch(uploadFile({ file: selectedFile, folder: folderId, comment }));
    setSelectedFile(null);
    setComment('');
    if (onRefresh) onRefresh();
  };

  const doRename = async (f) => {
    const name = window.prompt("New name", f.original_name);
    if (!name) return;
    await dispatch(renameFile({ id: f.id, name }));
    if (onRefresh) onRefresh();
  };

  const doMove = (f) => {
    // Instead of prompt, delegate to FileManager to open modal
    if (onRequestMove) onRequestMove(f);
  };

  const doShare = async (f) => {
    const res = await dispatch(shareFile({ id: f.id }));
    if (res && res.payload && res.payload.share_url) {
      window.prompt("Share URL (copy):", res.payload.share_url);
    } else {
      alert("Share failed");
    }
  };

  const doDelete = async (f) => {
    if (!window.confirm("Delete file?")) return;
    await dispatch(deleteFile({ id: f.id }));
    if (onRefresh) onRefresh();
  };

  return (
    <div>
      <form className="mb-4 flex gap-2 items-center" onSubmit={handleUpload}>
        <input type="file" onChange={e => setSelectedFile(e.target.files[0])} />
        <input placeholder="Comment" value={comment} onChange={e=>setComment(e.target.value)} className="border p-1 rounded flex-1" />
        <button className="px-3 py-1 bg-green-600 text-white rounded" type="submit">Upload</button>
      </form>

      <div className="mb-3 flex items-center gap-2">
        <label className="text-sm">Sort:</label>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="border rounded p-1">
          <option value="uploaded_at">Date</option>
          <option value="original_name">Name</option>
          <option value="size">Size</option>
        </select>
        <button onClick={()=>setOrder(order==='asc'?'desc':'asc')} className="px-2 py-1 border rounded">{order}</button>
      </div>

      <div className="grid gap-3">
        {sorted.map(f => (
          <div key={f.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
            <div>
              <div className="font-medium">{f.original_name}</div>
              <div className="text-xs text-gray-500">Size: {f.size} — Uploaded: {f.uploaded_at ? new Date(f.uploaded_at).toLocaleString() : ''}</div>
              {f.comment && <div className="text-sm text-gray-700 mt-1">{f.comment}</div>}
            </div>
            <div className="flex gap-2">
              <a href={f.download_url} className="text-sky-600 hover:underline">Download</a>
              <button onClick={()=>doRename(f)} className="text-sm">Rename</button>
              <button onClick={()=>doMove(f)} className="text-sm">Move</button>
              <button onClick={()=>doShare(f)} className="text-sm">{f.is_shared ? 'Re-share' : 'Share'}</button>
              <button onClick={()=>doDelete(f)} className="text-sm text-red-600">Delete</button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && <div className="text-sm text-gray-500">No files in this folder</div>}
      </div>
    </div>
  );
}
