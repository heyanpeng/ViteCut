import "./PlaybackControls.css";
import {
  Scissors,
  Copy,
  Trash2,
  SkipBack,
  Play,
  SkipForward,
  ZoomOut,
  ZoomIn,
  Maximize2,
  Maximize,
  SlidersHorizontal,
} from "lucide-react";

export function PlaybackControls() {
  return (
    <div className="playback-controls">
      <div className="playback-controls__left">
        <button className="playback-controls__btn" disabled title="Cut">
          <Scissors size={16} />
        </button>
        <button className="playback-controls__btn" disabled title="Copy">
          <Copy size={16} />
        </button>
        <button className="playback-controls__btn" disabled title="Delete">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="playback-controls__center">
        <button
          className="playback-controls__btn"
          disabled
          title="Previous Frame"
        >
          <SkipBack size={16} />
        </button>
        <button
          className="playback-controls__btn playback-controls__play-btn"
          disabled
          title="Play"
        >
          <Play size={16} fill="currentColor" />
        </button>
        <button className="playback-controls__btn" disabled title="Next Frame">
          <SkipForward size={16} />
        </button>
        <span className="playback-controls__time">0:00.00</span>
        <span className="playback-controls__separator">/</span>
        <span className="playback-controls__time">0:00.00</span>
      </div>
      <div className="playback-controls__right">
        <button
          className="playback-controls__btn"
          disabled
          title="Track Settings"
        >
          <SlidersHorizontal size={16} />
        </button>
        <span className="playback-controls__divider">|</span>
        <button className="playback-controls__btn" disabled title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <button className="playback-controls__btn" disabled title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <button className="playback-controls__btn" disabled title="Fit to View">
          <Maximize2 size={16} />
        </button>
        <span className="playback-controls__divider">|</span>
        <button className="playback-controls__btn" disabled title="Fullscreen">
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
}
