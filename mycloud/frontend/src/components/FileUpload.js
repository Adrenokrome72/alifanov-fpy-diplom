// frontend/src/components/FileUpload.js
import React, { useState } from 'react';
import api, { initCsrf, setCSRFCookieHeader } from '../api/axios';
import ProgressBar from './ProgressBar';

export default function FileUpload({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const submit = async (e) => {
    e && e.preventDefault();
    if (!file) {
      setStatus('No file selected');
      return;
    }
    setStatus('');
    setProgress(0);
    try {
      await initCsrf();
      setCSRFCookieHeader();

      const fd = new FormData();
      fd.append('file', file);
      fd.append('comment', comment || '');

      const r = await api.post('/storage/files/upload/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) {
            setProgress(ev.loaded / ev.total);
          }
        }
      });

      setStatus('Upload successful');
      setFile(null);
      setComment('');
      setProgress(0);
      onUploaded && onUploaded(r.data);
    } catch (err) {
      console.error('FileUpload error', err);
      setStatus('Upload failed: ' + (err.response?.data?.detail || err.message));
      setProgress(0);
    }
  };

  return (
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:8}}>
      <input type="file" onChange={e => setFile(e.target.files[0])} />
      <input value={comment} onChange={e => setComment(e.target.value)} placeholder="comment" className="input" />
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button type="submit" className="btn">Upload</button>
        {progress > 0 && <div style={{width:200}}><ProgressBar value={progress} /></div>}
      </div>
      {status && <div className="small-muted" style={{marginTop:6}}>{status}</div>}
    </form>
  );
}
