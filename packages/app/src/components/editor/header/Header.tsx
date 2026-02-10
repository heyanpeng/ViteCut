import { Undo, Redo, Upload, Clapperboard, Github } from "lucide-react";
import { useState } from "react";
import { useProjectStore } from "../../../stores";
import "./Header.css";

export function Header() {
  const project = useProjectStore((s) => s.project);
  const loading = useProjectStore((s) => s.loading);
  const exportToMp4 = useProjectStore((s) => s.exportToMp4);
  const [exporting, setExporting] = useState(false);

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
          defaultValue="23 Jan 2026"
        />
      </div>
      <div className="app-editor-layout__header-right">
        <button className="app-editor-layout__header-btn" disabled title="Undo">
          <Undo size={16} />
        </button>
        <button className="app-editor-layout__header-btn" disabled title="Redo">
          <Redo size={16} />
        </button>
        <button
          className="app-editor-layout__header-btn app-editor-layout__export-btn"
          disabled={!canExport}
          title="Export"
          type="button"
          onClick={handleExport}
        >
          <Upload size={16} />
          <span>{exporting ? "导出中..." : "导出"}</span>
        </button>
        <a
          href="https://github.com/heyanpeng/SwiftAV"
          target="_blank"
          rel="noopener noreferrer"
          className="app-editor-layout__header-btn app-editor-layout__github-btn"
          title="GitHub"
        >
          <Github size={16} />
        </a>
      </div>
    </header>
  );
}
