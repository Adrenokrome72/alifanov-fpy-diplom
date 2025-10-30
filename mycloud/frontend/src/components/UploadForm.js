import React, {useState} from 'react';
import { uploadFile } from '../api/storage';

export default function UploadForm({onUploaded, folderId}){
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e){
    e.preventDefault();
    if(!file) return;
    setLoading(true);
    try{
      const resp = await uploadFile(file, comment, folderId);
      onUploaded && onUploaded(resp.data);
    }catch(err){
      alert('Upload failed: '+ (err.response?.data?.detail || err.message));
    }finally{ setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="upload-form">
      <input type="file" onChange={e=>setFile(e.target.files[0])}/>
      <input placeholder="comment" value={comment} onChange={e=>setComment(e.target.value)} />
      <button disabled={loading} type="submit" className="btn">{loading ? 'Uploading...' : 'Upload'}</button>
    </form>
  );
}
