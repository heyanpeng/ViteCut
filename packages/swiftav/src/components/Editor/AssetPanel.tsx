import './AssetPanel.css';

export function AssetPanel() {
  return (
    <div className="asset-panel">
      <div className="asset-panel__upload-area">
        <div className="asset-panel__upload-icon">
          <span className="asset-panel__cloud-icon">☁</span>
          <span className="asset-panel__arrow-icon">↑</span>
        </div>
        <label className="asset-panel__upload-label">
          <span className="asset-panel__upload-text-primary">点击上传</span>
          <span className="asset-panel__upload-text-secondary">或将文件拖放到此处</span>
        </label>
      </div>
      <div className="asset-panel__cloud-storage">
        <button className="asset-panel__storage-btn" title="Google Drive">
          <span>G</span>
        </button>
        <button className="asset-panel__storage-btn" title="Dropbox">
          <span>D</span>
        </button>
        <button className="asset-panel__storage-btn" title="Record">
          <span>●</span>
        </button>
        <button className="asset-panel__storage-btn" title="Audio">
          <span>〰</span>
        </button>
      </div>
    </div>
  );
}
