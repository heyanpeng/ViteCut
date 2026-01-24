import { Header } from "./header/Header";
import { OptionsPanel } from "./content/OptionsPanel";
import { Player } from "./content/Player";
import { Timeline } from "./timeline/Timeline";
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
