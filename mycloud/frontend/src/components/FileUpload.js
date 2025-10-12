// frontend/src/components/FileUpload.js
import React, {useState} from 'react';
import api from '../api/axios';

export default function FileUpload({onUploaded}) {
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const submit = async (e)=>{
    e.preventDefault();
    if(!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('comment', comment);
    const r = await api.post('/storage/files/upload/', fd, { headers: {'Content-Type':'multipart/form-data'} });
    onUploaded && onUploaded(r.data);
  };
  return (
    <form onSubmit={submit}>
      <input type="file" onChange={e=>setFile(e.target.files[0])}/>
      <input value={comment} onChange={e=>setComment(e.target.value)} placeholder="comment"/>
      <button type="submit">Upload</button>
    </form>
  );
}
