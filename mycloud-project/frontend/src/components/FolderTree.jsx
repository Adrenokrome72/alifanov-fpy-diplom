// frontend/src/components/FolderTree.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFolders, createFolder, deleteFolder, renameFolder } from '../features/foldersSlice';

export default function FolderTree({ onSelectFolder, selectedFolder }) {
  const dispatch = useDispatch();
  const folders = useSelector(s => s.folders.items || []);
  const status = useSelector(s => s.folders.status);
  const [newName, setNewName] = useState("");

  useEffect(() => { dispatch(fetchFolders()); }, [dispatch]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await dispatch(createFolder({ name: newName.trim() }));
    setNewName("");
    dispatch(fetchFolders());
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete folder and all its contents?")) return;
    await dispatch(deleteFolder({ id }));
    dispatch(fetchFolders());
    if (selectedFolder === id) onSelectFolder(null);
  };

  const handleRename = async (folder) => {
    const name = window.prompt("New folder name", folder.name);
    if (!name) return;
    await dispatch(renameFolder({ id: folder.id, name }));
    dispatch(fetchFolders());
  };

  return (
    <div className="bg-white p-3 rounded shadow">
      <div className="mb-3">
        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="New folder name"
               className="border rounded p-1 w-full" />
        <div className="mt-2 flex gap-2">
          <button onClick={handleCreate} className="px-3 py-1 bg-sky-600 text-white rounded">Create</button>
          <div className="text-sm text-gray-500 self-center">Folders: {folders.length}</div>
        </div>
      </div>

      <div>
        {status === 'loading' && <div className="text-sm text-gray-500">Loading...</div>}
        <ul className="space-y-2">
          {folders.map(folder => (
            <li key={folder.id} className={`p-2 rounded hover:bg-gray-50 ${selectedFolder === folder.id ? 'bg-sky-50 border' : ''}`}>
              <div className="flex justify-between items-center">
                <button onClick={() => onSelectFolder(folder.id)} className="text-left flex-1">
                  <div className="font-medium">{folder.name}</div>
                  <div className="text-xs text-gray-500">ID: {folder.id}</div>
                </button>
                <div className="flex gap-2 ml-2">
                  <button onClick={()=>handleRename(folder)} className="text-sm text-gray-700">Rename</button>
                  <button onClick={()=>handleDelete(folder.id)} className="text-sm text-red-600">Delete</button>
                </div>
              </div>
            </li>
          ))}
          {folders.length === 0 && <li className="text-sm text-gray-500">No folders yet</li>}
        </ul>
      </div>
    </div>
  );
}
