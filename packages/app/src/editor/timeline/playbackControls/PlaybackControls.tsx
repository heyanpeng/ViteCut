import "./PlaybackControls.css";
import { Tooltip } from "@/components/Tooltip";
import { Button } from "@radix-ui/themes";
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
        <Tooltip content="Cut">
          <button
            className="playback-controls__btn"
            disabled={!onCutClip}
            onClick={onCutClip}
          >
            <Scissors size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Copy">
          <button
            className="playback-controls__btn"
            disabled={!onCopyClip}
            onClick={onCopyClip}
          >
            <Copy size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Delete">
          <button
            className="playback-controls__btn"
            disabled={!onDeleteClip}
            onClick={onDeleteClip}
          >
            <Trash2 size={16} />
          </button>
        </Tooltip>
      </div>
      {/* 中间播放主控区域 */}
      <div className="playback-controls__center">
        <Tooltip content="Go to Start">
          <button
            className="playback-controls__btn"
            disabled={disabled}
            onClick={onStepBackward}
          >
            <SkipBack size={16} />
          </button>
        </Tooltip>
        <Tooltip content={isPlaying ? "Pause" : "Play"}>
          <Button
            variant="solid"
            radius="full"
            size="1"
            className="playback-controls__play-btn"
            disabled={disabled}
            onClick={onTogglePlay}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </Button>
        </Tooltip>
        <Tooltip content="Go to End">
          <button
            className="playback-controls__btn"
            disabled={disabled}
            onClick={onStepForward}
          >
            <SkipForward size={16} />
          </button>
        </Tooltip>
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
        <Tooltip content="Track Settings">
          <button className="playback-controls__btn" disabled>
            <SlidersHorizontal size={16} />
          </button>
        </Tooltip>
        <span className="playback-controls__divider">|</span>
        <Tooltip content="Zoom Out">
          <button
            className="playback-controls__btn"
            disabled={disabled}
            onClick={onZoomOut}
          >
            <ZoomOut size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Zoom In">
          <button
            className="playback-controls__btn"
            disabled={disabled}
            onClick={onZoomIn}
          >
            <ZoomIn size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Fit to View">
          <button
            className="playback-controls__btn"
            disabled={disabled}
            onClick={onFitToView}
          >
            <Maximize2 size={16} />
          </button>
        </Tooltip>
        <span className="playback-controls__divider">|</span>
        <Tooltip content="Fullscreen">
          <button className="playback-controls__btn" disabled>
            <Maximize size={16} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
