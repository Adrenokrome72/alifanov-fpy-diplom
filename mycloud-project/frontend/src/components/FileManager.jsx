import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFiles, uploadFile } from '../features/filesSlice';

export default function FileManager(){
  const dispatch = useDispatch();
  const files = useSelector(s => s.files.items || []);
  const [file, setFile] = useState(null);

  useEffect(()=>{ dispatch(fetchFiles()); }, [dispatch]);

  const onUpload = async (e) => {
    e.preventDefault();
    if(!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await dispatch(uploadFile(fd));
    setFile(null);
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-xl mb-4">Files</h2>
      <form onSubmit={onUpload} className="mb-4">
        <input type="file" onChange={e=>setFile(e.target.files[0])} />
        <button className="ml-2 bg-blue-600 text-white p-2 rounded">Upload</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {files.map(f=> (
          <div key={f.id} className="border p-3">
            <div className="font-semibold">{f.original_name}</div>
            <div className="text-sm">{f.size} bytes</div>
            <div className="mt-2 flex gap-2">
              <a className="text-blue-600" href={f.download_url}>Download</a>
              {f.share_url && <a className="text-green-600" href={f.share_url}>Share</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}