import { Cloud, Upload } from "lucide-react";
import { useRef } from "react";
import { useProjectStore } from "@/stores";
import "./MediaPanel.css";

export function MediaPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadVideoFile = useProjectStore((s) => s.loadVideoFile);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await loadVideoFile(file);
    // 清空 input 值，以便可以选择同一个文件重新导入
    event.target.value = "";
  };

  return (
    <div className="asset-panel">
      <div className="asset-panel__upload-area">
        <div className="asset-panel__upload-icon" onClick={handleClick}>
          <Cloud size={48} className="asset-panel__cloud-icon" />
          <Upload size={20} className="asset-panel__arrow-icon" />
        </div>
        <label className="asset-panel__upload-label" onClick={handleClick}>
          <span className="asset-panel__upload-text-primary">点击上传</span>
          <span className="asset-panel__upload-text-secondary">
            或将文件拖放到此处
          </span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
