import { Cloud, Upload } from "lucide-react";
import { useState } from "react";
import { useAddMedia } from "@/hooks/useAddMedia";
import "./MediaPanel.css";

export function MediaPanel() {
  const { trigger, loadFile, fileInputRef, fileInputProps } = useAddMedia();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    const file = Array.from(files).find(
      (f) => f.type.startsWith("video/") || f.type.startsWith("image/"),
    );
    if (!file) return;
    await loadFile(file);
  };

  return (
    <div className="asset-panel">
      <div
        className={`asset-panel__upload-area ${isDragging ? "asset-panel__upload-area--dragging" : ""}`}
        onClick={trigger}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="asset-panel__upload-icon">
          <Cloud size={48} className="asset-panel__cloud-icon" />
          <Upload size={20} className="asset-panel__arrow-icon" />
        </div>
        <label className="asset-panel__upload-label">
          <span className="asset-panel__upload-text-primary">点击上传</span>
          <span className="asset-panel__upload-text-secondary">
            支持视频、图片，或将文件拖放到此处
          </span>
        </label>
        <input ref={fileInputRef} {...fileInputProps} />
      </div>
    </div>
  );
}
