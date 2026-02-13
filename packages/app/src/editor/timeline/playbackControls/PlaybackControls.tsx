import "./PlaybackControls.css";
import { formatTime } from "@swiftav/utils";
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

// 播放控制条Props定义：控制播放状态、跳转、缩放、适应视图区等交互
type PlaybackControlsProps = {
  isPlaying: boolean; // 是否正在播放
  currentTime: number; // 当前播放时间(s)
  duration: number; // 媒体总时长(s)
  disabled?: boolean; // 是否整体禁用控制条（例如无 project 时）
  onTogglePlay: () => void; // 播放/暂停切换回调
  onStepBackward: () => void; // 跳转到起始/上一段回调
  onStepForward: () => void; // 跳转到末尾/下一段回调
  onZoomOut: () => void; // 时间轴缩小回调
  onZoomIn: () => void; // 时间轴放大回调
  onFitToView: () => void; // 一键适应视图区回调
  onCutClip?: () => void; // 在播放头处将选中 clip 切成两段，仅当播放头在该 clip 内时可用
  onCopyClip?: () => void; // 复制当前选中的 clip 到同轨道末尾，无选中时可不传或置为 undefined
  onDeleteClip?: () => void; // 删除当前选中的 clip，无选中时可不传或置为 undefined
};

// 播放控制条主组件
export const PlaybackControls = ({
  isPlaying,
  currentTime,
  duration,
  disabled = false,
  onTogglePlay,
  onStepBackward,
  onStepForward,
  onZoomOut,
  onZoomIn,
  onFitToView,
  onCutClip,
  onCopyClip,
  onDeleteClip,
}: PlaybackControlsProps) => {
  return (
    <div className="playback-controls">
      {/* 左侧剪切/复制/删除工具区 */}
      <div className="playback-controls__left">
        <button
          className="playback-controls__btn"
          disabled={!onCutClip}
          title="Cut"
          onClick={onCutClip}
        >
          <Scissors size={16} />
        </button>
        <button
          className="playback-controls__btn"
          disabled={!onCopyClip}
          title="Copy"
          onClick={onCopyClip}
        >
          <Copy size={16} />
        </button>
        <button
          className="playback-controls__btn"
          disabled={!onDeleteClip}
          title="Delete"
          onClick={onDeleteClip}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {/* 中间播放主控区域 */}
      <div className="playback-controls__center">
        {/* 跳到起点 */}
        <button
          className="playback-controls__btn"
          disabled={disabled}
          title="Go to Start"
          onClick={onStepBackward}
        >
          <SkipBack size={16} />
        </button>
        {/* 播放/暂停切换按钮 */}
        <button
          className="playback-controls__btn playback-controls__play-btn"
          title={isPlaying ? "Pause" : "Play"}
          disabled={disabled}
          onClick={onTogglePlay}
        >
          {isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
        {/* 跳到结尾 */}
        <button
          className="playback-controls__btn"
          title="Go to End"
          disabled={disabled}
          onClick={onStepForward}
        >
          <SkipForward size={16} />
        </button>
        {/* 当前时间显示 */}
        <span className="playback-controls__time">
          {formatTime(currentTime)}
        </span>
        <span className="playback-controls__separator">/</span>
        {/* 媒体总时长显示 */}
        <span className="playback-controls__time">{formatTime(duration)}</span>
      </div>
      {/* 右侧轨道设置与缩放控制 */}
      <div className="playback-controls__right">
        {/* 轨道设置按钮（暂未启用） */}
        <button
          className="playback-controls__btn"
          disabled
          title="Track Settings"
        >
          <SlidersHorizontal size={16} />
        </button>
        <span className="playback-controls__divider">|</span>
        {/* 时间轴缩放按钮 */}
        <button
          className="playback-controls__btn"
          title="Zoom Out"
          disabled={disabled}
          onClick={onZoomOut}
        >
          <ZoomOut size={16} />
        </button>
        <button
          className="playback-controls__btn"
          title="Zoom In"
          disabled={disabled}
          onClick={onZoomIn}
        >
          <ZoomIn size={16} />
        </button>
        {/* 适应视图 */}
        <button
          className="playback-controls__btn"
          title="Fit to View"
          disabled={disabled}
          onClick={onFitToView}
        >
          <Maximize2 size={16} />
        </button>
        <span className="playback-controls__divider">|</span>
        {/* 全屏按钮（暂未实现） */}
        <button className="playback-controls__btn" disabled title="Fullscreen">
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
};
