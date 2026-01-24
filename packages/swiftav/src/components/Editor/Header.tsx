import './Header.css';

export function Header() {
  return (
    <header className="app-editor-layout__header">
      <div className="app-editor-layout__header-left">
        <a href="/" className="app-editor-layout__logo">
          <span className="app-editor-layout__logo-icon">▶</span>
        </a>
        <input
          type="text"
          className="app-editor-layout__project-name"
          value="23 Jan 2026"
          readOnly
        />
      </div>
      <div className="app-editor-layout__header-right">
        <button className="app-editor-layout__header-btn" disabled title="Undo">
          <span>↶</span>
        </button>
        <button className="app-editor-layout__header-btn" disabled title="Redo">
          <span>↷</span>
        </button>
        <button className="app-editor-layout__header-btn app-editor-layout__export-btn" disabled title="Export">
          <span>↑</span>
          <span>导出</span>
        </button>
      </div>
    </header>
  );
}
