import { Tooltip } from "@/components/Tooltip";
import { Undo, Redo, Upload, Clapperboard, Github } from "lucide-react";
import { useState } from "react";
import { useProjectStore } from "@/stores";
import "./Header.css";

export function Header() {
  const project = useProjectStore((s) => s.project);
  const loading = useProjectStore((s) => s.loading);
  const exportToMp4 = useProjectStore((s) => s.exportToMp4);
  const [exporting, setExporting] = useState(false);

  // 当前日期显示，格式类似 "11 Feb 2026"
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const handleExport = async () => {
    if (!project || exporting) return;
    setExporting(true);
    try {
      const blob = await exportToMp4();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name || "swiftav-export"}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const canExport = !!project && !loading && !exporting;

  return (
    <header className="app-editor-layout__header">
      <div className="app-editor-layout__header-left">
        <a href="/" className="app-editor-layout__logo">
          <Clapperboard size={24} className="app-editor-layout__logo-icon" />
        </a>
        <input
          type="text"
          className="app-editor-layout__project-name"
          defaultValue={todayLabel}
        />
      </div>
      <div className="app-editor-layout__header-right">
        <Tooltip content="Undo">
          <button className="app-editor-layout__header-btn" disabled>
            <Undo size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Redo">
          <button className="app-editor-layout__header-btn" disabled>
            <Redo size={16} />
          </button>
        </Tooltip>
        <button
          className="app-editor-layout__header-btn app-editor-layout__export-btn"
          disabled={!canExport}
          type="button"
          onClick={handleExport}
        >
          <Upload size={16} />
          <span>{exporting ? "导出中..." : "导出"}</span>
        </button>
        <Tooltip content="GitHub">
          <a
            href="https://github.com/heyanpeng/SwiftAV"
            target="_blank"
            rel="noopener noreferrer"
            className="app-editor-layout__header-btn app-editor-layout__github-btn"
          >
            <Github size={16} />
          </a>
        </Tooltip>
      </div>
    </header>
  );
}
