import "./PlaybackControls.css";
import {
  Scissors,
  Copy,
  Trash2,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  ZoomOut,
  ZoomIn,
  Maximize2,
  Maximize,
  SlidersHorizontal,
} from "lucide-react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFitToView: () => void;
}

function formatTime(time: number): string {
  const clamped = Math.max(0, time);
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  const ms = Math.floor((clamped * 100) % 100);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(2, "0")}`;
}

export function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onStepBackward,
  onStepForward,
  onZoomOut,
  onZoomIn,
  onFitToView,
}: PlaybackControlsProps) {
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
          title="Go to Start"
          onClick={onStepBackward}
        >
          <SkipBack size={16} />
        </button>
        <button
          className="playback-controls__btn playback-controls__play-btn"
          title={isPlaying ? "Pause" : "Play"}
          onClick={onTogglePlay}
        >
          {isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
        <button
          className="playback-controls__btn"
          title="Go to End"
          onClick={onStepForward}
        >
          <SkipForward size={16} />
        </button>
        <span className="playback-controls__time">
          {formatTime(currentTime)}
        </span>
        <span className="playback-controls__separator">/</span>
        <span className="playback-controls__time">
          {formatTime(duration)}
        </span>
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
        <button
          className="playback-controls__btn"
          title="Zoom Out"
          onClick={onZoomOut}
        >
          <ZoomOut size={16} />
        </button>
        <button
          className="playback-controls__btn"
          title="Zoom In"
          onClick={onZoomIn}
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="playback-controls__btn"
          title="Fit to View"
          onClick={onFitToView}
        >
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
