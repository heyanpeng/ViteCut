import { PlaybackControls } from './PlaybackControls';
import './Timeline.css';

export function Timeline() {
  return (
    <div className="app-editor-layout__timeline">
      <PlaybackControls />
      <div className="app-editor-layout__timeline-content">
        <p className="app-editor-layout__timeline-message">将媒体添加到时间轴以开始创建视频</p>
      </div>
    </div>
  );
}
