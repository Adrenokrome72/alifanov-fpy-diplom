import React from 'react';

export default function FileList({files, onDownload, onShare}){
  if(!files) return <div>No files</div>;
  return (
    <table className="file-table">
      <thead><tr><th>Name</th><th>Size</th><th>Preview</th><th>Actions</th></tr></thead>
      <tbody>
        {files.map(f=>(
          <tr key={f.id}>
            <td>{f.name}</td>
            <td>{f.size ? (f.size/1024).toFixed(1)+' KB' : '-'}</td>
            <td>{f.thumbnail ? <img src={f.thumbnail} alt="" style={{width:48,height:48,objectFit:'cover'}}/> : '-'}</td>
            <td>
              <button className="btn" onClick={()=>onDownload(f.id)}>Download</button>
              <button className="btn ghost" onClick={()=>onShare(f.id)}>Share</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
