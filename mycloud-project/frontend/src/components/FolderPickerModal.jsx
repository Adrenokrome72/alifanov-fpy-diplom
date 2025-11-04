// frontend/src/components/FolderPickerModal.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFolders } from '../features/foldersSlice';

/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onConfirm: (targetFolderId|null) => void
 *  - currentFolder: id|null (optional)
 */
export default function FolderPickerModal({ open, onClose, onConfirm, currentFolder = null }) {
  const dispatch = useDispatch();
  const folders = useSelector(s => s.folders.items || []);
  const [selected, setSelected] = useState(currentFolder ?? null);

  useEffect(() => {
    if (open) {
      dispatch(fetchFolders());
      setSelected(currentFolder ?? null);
    }
  }, [open, dispatch, currentFolder]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded p-4 w-full max-w-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-3">Select destination folder</h3>

        <div className="mb-3">
          <div className={`p-2 rounded cursor-pointer ${selected === null ? 'bg-sky-50 border' : ''}`}
               onClick={() => setSelected(null)}>
            <div className="font-medium">Root (no folder)</div>
          </div>
          <div className="mt-2 space-y-2 max-h-64 overflow-auto">
            {folders.map(f => (
              <div key={f.id} className={`p-2 rounded cursor-pointer ${selected === f.id ? 'bg-sky-50 border' : ''}`}
                   onClick={() => setSelected(f.id)}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-gray-500">ID: {f.id}</div>
                  </div>
                </div>
              </div>
            ))}
            {folders.length === 0 && <div className="text-sm text-gray-500">No folders</div>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
          <button onClick={() => onConfirm(selected)} className="px-3 py-1 bg-sky-600 text-white rounded">Move here</button>
        </div>
      </div>
    </div>
  );
}
