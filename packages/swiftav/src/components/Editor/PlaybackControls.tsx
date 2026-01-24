import './PlaybackControls.css';

export function PlaybackControls() {
  return (
    <div className="playback-controls">
      <div className="playback-controls__left">
        <button className="playback-controls__btn" disabled title="Cut">
          <span>✂</span>
        </button>
        <button className="playback-controls__btn" disabled title="Copy">
          <span>📋</span>
        </button>
        <button className="playback-controls__btn" disabled title="Delete">
          <span>🗑</span>
        </button>
      </div>
      <div className="playback-controls__center">
        <button className="playback-controls__btn" disabled title="Previous Frame">
          <span>|◀</span>
        </button>
        <button className="playback-controls__btn playback-controls__play-btn" disabled title="Play">
          <span>▶</span>
        </button>
        <button className="playback-controls__btn" disabled title="Next Frame">
          <span>▶|</span>
        </button>
        <span className="playback-controls__time">0:00.00</span>
        <span className="playback-controls__separator">/</span>
        <span className="playback-controls__time">0:00.00</span>
      </div>
      <div className="playback-controls__right">
        <button className="playback-controls__btn" disabled title="Track Settings">
          <span>☰</span>
        </button>
        <span className="playback-controls__divider">|</span>
        <button className="playback-controls__btn" disabled title="Zoom Out">
          <span>-</span>
        </button>
        <button className="playback-controls__btn" disabled title="Zoom In">
          <span>+</span>
        </button>
        <button className="playback-controls__btn" disabled title="Fit to View">
          <span>⇄</span>
        </button>
        <span className="playback-controls__divider">|</span>
        <button className="playback-controls__btn" disabled title="Fullscreen">
          <span>⛶</span>
        </button>
      </div>
    </div>
  );
}
