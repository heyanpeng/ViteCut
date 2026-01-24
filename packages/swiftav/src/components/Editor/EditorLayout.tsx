import { Header } from './Header';
import { OptionsPanel } from './OptionsPanel';
import { Player } from './Player';
import { Timeline } from './Timeline';
import './EditorLayout.css';

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
