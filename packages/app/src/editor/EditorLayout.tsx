import { Header } from "@/editor/header/Header";
import { OptionsPanel } from "@/editor/options/OptionsPanel";
import { Player } from "@/editor/player/Player";
import { Timeline } from "@/editor/timeline/Timeline";
import "./EditorLayout.css";

export function EditorLayout() {
  return (
    <div className="app-editor-layout">
      <Header />
      <div className="app-editor-layout__content">
        <OptionsPanel />
        <Player />
      </div>
      <Timeline />
    </div>
  );
}
