// frontend/src/components/AdminStorageView.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from "react-router-dom";

// Рекурсивный компонент для дерева папок
const FolderTree = ({ folders, onFolderClick, currentFolderId, level = 0 }) => {
  if (!folders || folders.length === 0) return null;

  return (
    <div className="folder-tree" style={{ marginLeft: level * 20 }}>
      {folders.map(folder => (
        <div key={folder.id} className="tree-node">
          <div 
            className={`tree-folder ${currentFolderId === folder.id ? 'active' : ''}`}
            onClick={() => onFolderClick(folder)}
          >
            {folder.children && folder.children.length > 0 ? '📂' : '📁'} {folder.name}
          </div>
          {/* Рекурсивно отображаем детей */}
          {folder.children && folder.children.length > 0 && (
            <FolderTree 
              folders={folder.children} 
              onFolderClick={onFolderClick}
              currentFolderId={currentFolderId}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// Вспомогательная функция
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Основной компонент админского просмотра
const AdminStorageView = () => {
  const { userId } = useParams();
  const [storageTree, setStorageTree] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [currentContents, setCurrentContents] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загружаем полное дерево при монтировании
  useEffect(() => {
    // Проверяем, что userId валидный
    if (!userId || userId === 'undefined' || userId === 'null' || isNaN(parseInt(userId))) {
      setError(`Invalid user ID: ${userId}`);
      setLoading(false);
      return;
    }
    fetchStorageTree();
  }, [userId]);

  const fetchStorageTree = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin-users/${userId}/storage_tree/`);
      if (response.ok) {
        const data = await response.json();
        setStorageTree(data);
        setCurrentContents({
          folders: data.root_folders || [],
          files: data.root_files || []
        });
      } else {
        throw new Error('Failed to fetch storage tree');
      }
    } catch (error) {
      console.error('Error fetching storage tree:', error);
      setError('Error loading storage data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderContents = async (folderId) => {
    try {
      const response = await fetch(`/api/admin-users/${userId}/folder_contents/?folder_id=${folderId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentFolder(data.folder);
        setCurrentContents({
          folders: data.children || [],
          files: data.files || []
        });
      }
    } catch (error) {
      console.error('Error fetching folder contents:', error);
    }
  };

  const handleFolderClick = (folder) => {
    fetchFolderContents(folder.id);
  };

  const handleBackToRoot = () => {
    setCurrentFolder(null);
    if (storageTree) {
      setCurrentContents({
        folders: storageTree.root_folders || [],
        files: storageTree.root_files || []
      });
    }
  };

  if (error) return <div>Error: {error}</div>;
  if (loading) return <div>Loading...</div>;
  if (!storageTree) return <div>Error loading storage</div>;

  return (
    <div className="admin-storage-view">
      <div className="storage-header">
        <h2>Storage of {storageTree.user_info?.username}</h2>
        {currentFolder && (
          <button onClick={handleBackToRoot} className="back-button">
            Back to Root
          </button>
        )}
      </div>

      <div className="storage-layout">
        {/* Левая панель - дерево навигации */}
        <div className="tree-panel">
          <h3>Folder Tree</h3>
          <FolderTree 
            folders={storageTree.root_folders} 
            onFolderClick={handleFolderClick}
            currentFolderId={currentFolder?.id}
          />
        </div>

        {/* Правая панель - содержимое текущей папки */}
        <div className="content-panel">
          <div className="current-path">
            <strong>Current Path:</strong> {currentFolder ? currentFolder.name : 'Root'}
          </div>
          
          {/* Отображение папок */}
          <div className="folders-section">
            <h4>Folders</h4>
            {currentContents.folders.map(folder => (
              <div 
                key={folder.id} 
                className="folder-item"
                onClick={() => handleFolderClick(folder)}
              >
                📁 {folder.name}
              </div>
            ))}
            {currentContents.folders.length === 0 && <div>No folders</div>}
          </div>

          {/* Отображение файлов */}
          <div className="files-section">
            <h4>Files</h4>
            {currentContents.files.map(file => (
              <div key={file.id} className="file-item">
                📄 {file.original_name} ({formatFileSize(file.size)})
              </div>
            ))}
            {currentContents.files.length === 0 && <div>No files</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStorageView;