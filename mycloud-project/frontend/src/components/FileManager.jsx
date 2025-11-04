// frontend/src/components/FileManager.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import FolderTree from './FolderTree';
import FileList from './FileList';
import Breadcrumbs from './Breadcrumbs';
import FolderPickerModal from './FolderPickerModal';
import { fetchFiles } from '../features/filesSlice';
import { apiFetch } from '../api';

export default function FileManager() {
  const dispatch = useDispatch();
  const files = useSelector(s => s.files.items || []);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    dispatch(fetchFiles({ folder: selectedFolder }));
    buildBreadcrumbs(selectedFolder);
  }, [dispatch, selectedFolder]);

  // Build breadcrumb trail by walking parents via API
  const buildBreadcrumbs = async (folderId) => {
    if (!folderId) {
      setBreadcrumbs([]);
      return;
    }
    try {
      const trail = [];
      let currentId = folderId;
      // loop up to avoid infinite loops
      for (let i = 0; i < 20 && currentId; i++) {
        // GET /api/folders/{id}/
        const folder = await apiFetch(`/api/folders/${currentId}/`);
        trail.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parent; // expects parent to be id or null
      }
      setBreadcrumbs(trail);
    } catch (err) {
      console.error('Breadcrumb build failed', err);
      setBreadcrumbs([]);
    }
  };

  const handleSelectFolder = (id) => {
    setSelectedFolder(id);
  };

  const handleRequestMove = (file) => {
    // open picker modal and set target file
    setFileToMove(file);
    setIsPickerOpen(true);
  };

  const handlePickerClose = () => {
    setIsPickerOpen(false);
    setFileToMove(null);
  };

  const handlePickerConfirm = async (targetFolderId) => {
    // dispatch moveFile from filesSlice
    if (!fileToMove) {
      handlePickerClose();
      return;
    }
    try {
      // move via API
      await dispatch({ type: 'files/move/pending' }); // optional placeholder
      await dispatch(require('../features/filesSlice').moveFile({ id: fileToMove.id, folder: targetFolderId })).unwrap();
    } catch (err) {
      console.error('Move failed', err);
      alert('Move failed: ' + (err?.data || err?.message || 'unknown'));
    } finally {
      handlePickerClose();
      dispatch(fetchFiles({ folder: selectedFolder }));
    }
  };

  const refresh = () => dispatch(fetchFiles({ folder: selectedFolder }));

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="md:col-span-1">
        <FolderTree onSelectFolder={handleSelectFolder} selectedFolder={selectedFolder} />
      </div>

      <div className="md:col-span-3">
        <div className="bg-white p-3 rounded shadow mb-4">
          <div className="flex items-center justify-between">
            <div>
              <Breadcrumbs
                breadcrumbs={breadcrumbs}
                onCrumbClick={(id) => { setSelectedFolder(id); }}
                rootLabel="Root"
              />
              <h2 className="text-xl font-semibold mt-2">Files {selectedFolder ? `(Folder ${selectedFolder})` : '(Root)'}</h2>
            </div>
            <div>
              <button onClick={refresh} className="px-3 py-1 border rounded">Refresh</button>
            </div>
          </div>
        </div>

        <FileList files={files} folderId={selectedFolder} onRefresh={refresh} onRequestMove={handleRequestMove} />
      </div>

      {isPickerOpen && (
        <FolderPickerModal
          open={isPickerOpen}
          onClose={handlePickerClose}
          onConfirm={handlePickerConfirm}
          currentFolder={selectedFolder}
        />
      )}
    </div>
  );
}
