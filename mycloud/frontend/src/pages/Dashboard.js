// frontend/src/pages/Dashboard.js
import React, {useEffect, useState} from 'react';
import api from '../api/axios';
import FileUpload from '../components/FileUpload';

export default function Dashboard(){
  const [files, setFiles] = useState([]);
  const load = async ()=> {
    const r = await api.get('/storage/files/');
    setFiles(r.data);
  };
  useEffect(()=>{load()},[]);
  return (
    <div>
      <h1>My files</h1>
      <FileUpload onUploaded={(f)=>setFiles(prev=>[f,...prev])}/>
      <ul>
        {files.map(f=>(
          <li key={f.id}>
            <a href={f.download_url}>{f.original_name}</a> ({f.size} bytes)
          </li>
        ))}
      </ul>
    </div>
  );
}
