import "./Header.css";
import { Undo2, Redo2, Upload, Clapperboard, Github } from "lucide-react";

export function Header() {
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
          <Undo2 size={16} />
        </button>
        <button className="app-editor-layout__header-btn" disabled title="Redo">
          <Redo2 size={16} />
        </button>
        <button
          className="app-editor-layout__header-btn app-editor-layout__export-btn"
          disabled
          title="Export"
        >
          <Upload size={16} />
          <span>导出</span>
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
