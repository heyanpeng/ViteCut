import './AssetPanel.css';
import { Cloud, Upload } from 'lucide-react';

export function AssetPanel() {
  return (
    <div className="asset-panel">
      <div className="asset-panel__upload-area">
        <div className="asset-panel__upload-icon">
          <Cloud size={48} className="asset-panel__cloud-icon" />
          <Upload size={20} className="asset-panel__arrow-icon" />
        </div>
        <label className="asset-panel__upload-label">
          <span className="asset-panel__upload-text-primary">点击上传</span>
          <span className="asset-panel__upload-text-secondary">或将文件拖放到此处</span>
        </label>
      </div>
    </div>
  );
}
