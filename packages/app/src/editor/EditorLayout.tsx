import { Header } from "@/editor/header/Header";
import { Library } from "@/editor/library/Library";
import { Preview } from "@/editor/preview/Preview";
import { Timeline } from "@/editor/timeline/Timeline";
import "./EditorLayout.css";

export function EditorLayout() {
  return (
    <div className="app-editor-layout">
      <Header />
      <div className="app-editor-layout__content">
        <Library />
        <div className="app-editor-layout__preview">
          <Preview />
        </div>
      </div>
      <Timeline />
    </div>
  );
}
