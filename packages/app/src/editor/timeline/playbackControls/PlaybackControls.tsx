import { useEffect, useState } from "react";
import "./PlaybackControls.css";
import { Tooltip } from "@/components/Tooltip";
import { Button } from "@radix-ui/themes";
import { Popover, Switch } from "radix-ui";
import { formatTime } from "@vitecut/utils";
import {
  SquareSplitHorizontal,
  CopyPlus,
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
  gridSnapEnabled?: boolean; // 是否启用网格吸附（第三方时间轴 gridSnap）
  dragLineEnabled?: boolean; // 是否启用辅助时间线吸附（第三方时间轴 dragLine）
  onGridSnapChange?: (value: boolean) => void; // 切换网格吸附
  onDragLineChange?: (value: boolean) => void; // 切换时间线吸附
  onTrimClipLeft?: () => void; // 向左裁剪当前选中 clip
  onTrimClipRight?: () => void; // 向右裁剪当前选中 clip
  onCutClip?: () => void; // 在播放头处将选中 clip 切成两段，仅当播放头在该 clip 内时可用
  onCopyClip?: () => void; // 复制当前选中的 clip 到同轨道末尾，无选中时可不传或置为 undefined
  onDeleteClip?: () => void; // 删除当前选中的 clip，无选中时可不传或置为 undefined
};

const TrimLeftIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 19H5c-1 0-2-1-2-2V7c0-1 1-2 2-2h3" strokeDasharray="1 4"></path>
    <path d="M16 5h3c1 0 2 1 2 2v10c0 1-1 2-2 2h-3"></path>
    <line x1="12" x2="12" y1="4" y2="20"></line>
  </svg>
);

const TrimRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 19H5c-1 0-2-1-2-2V7c0-1 1-2 2-2h3"></path>
    <path
      d="M16 5h3c1 0 2 1 2 2v10c0 1-1 2-2 2h-3"
      strokeDasharray="1 4"
    ></path>
    <line x1="12" x2="12" y1="4" y2="20"></line>
  </svg>
);

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
  gridSnapEnabled,
  dragLineEnabled,
  onGridSnapChange,
  onDragLineChange,
  onTrimClipLeft,
  onTrimClipRight,
  onCutClip,
  onCopyClip,
  onDeleteClip,
}: PlaybackControlsProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const previewContainer =
        document.querySelector<HTMLElement>(".preview-container");
      if (previewContainer?.requestFullscreen) {
        void previewContainer.requestFullscreen();
      }
      return;
    }

    if (document.exitFullscreen) {
      void document.exitFullscreen();
    }
  };

  return (
    <div className="playback-controls">
      {/* 左侧剪切/复制/删除工具区 */}
      <div className="playback-controls__left">
        <Tooltip content="向左裁剪">
          <button
            className="playback-controls__btn"
            disabled={!onTrimClipLeft}
            onClick={onTrimClipLeft}
          >
            <TrimLeftIcon />
          </button>
        </Tooltip>
        <Tooltip content="分割">
          <button
            className="playback-controls__btn"
            disabled={!onCutClip}
            onClick={onCutClip}
          >
            <SquareSplitHorizontal size={16} />
          </button>
        </Tooltip>
        <Tooltip content="向右裁剪">
          <button
            className="playback-controls__btn"
            disabled={!onTrimClipRight}
            onClick={onTrimClipRight}
          >
            <TrimRightIcon />
          </button>
        </Tooltip>
        <Tooltip content="复制">
          <button
            className="playback-controls__btn"
            disabled={!onCopyClip}
            onClick={onCopyClip}
          >
            <CopyPlus size={16} />
          </button>
        </Tooltip>
        <Tooltip content="删除">
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
        <Tooltip content="跳至开头">
          <button
            className="playback-controls__btn"
            disabled={disabled}
            onClick={onStepBackward}
          >
            <SkipBack size={16} />
          </button>
        </Tooltip>
        <Tooltip content={isPlaying ? "暂停" : "播放"}>
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
        <Tooltip content="跳至结尾">
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
        <Popover.Root>
          <Tooltip content="时间轴设置">
            <Popover.Trigger asChild>
              <button
                className="playback-controls__btn"
                type="button"
                aria-label="时间轴设置"
              >
                <SlidersHorizontal size={16} />
              </button>
            </Popover.Trigger>
          </Tooltip>
          <Popover.Portal>
            <Popover.Content
              className="playback-controls__popover-content"
              side="top"
              sideOffset={6}
              align="end"
            >
              <div className="playback-controls__popover-row">
                <span className="playback-controls__popover-label">
                  吸附网格
                </span>
                <Switch.Root
                  className="playback-controls__switch"
                  checked={gridSnapEnabled ?? true}
                  onCheckedChange={(value) => onGridSnapChange?.(value)}
                >
                  <Switch.Thumb className="playback-controls__switch-thumb" />
                </Switch.Root>
              </div>
              <div className="playback-controls__popover-row">
                <span className="playback-controls__popover-label">
                  吸附时间线
                </span>
                <Switch.Root
                  className="playback-controls__switch"
                  checked={dragLineEnabled ?? true}
                  onCheckedChange={(value) => onDragLineChange?.(value)}
                >
                  <Switch.Thumb className="playback-controls__switch-thumb" />
                </Switch.Root>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <span className="playback-controls__divider">|</span>
        <Tooltip content="缩小">
          <button
            className="playback-controls__btn"
            disabled={disabled}
            onClick={onZoomOut}
          >
            <ZoomOut size={16} />
          </button>
        </Tooltip>
        <Tooltip content="放大">
          <button
            className="playback-controls__btn"
            disabled={disabled}
            onClick={onZoomIn}
          >
            <ZoomIn size={16} />
          </button>
        </Tooltip>
        <Tooltip content="适应视图">
          <button
            className="playback-controls__btn"
            disabled={disabled}
            onClick={onFitToView}
          >
            <Maximize2 size={16} />
          </button>
        </Tooltip>
        <span className="playback-controls__divider">|</span>
        <Tooltip content={isFullscreen ? "退出全屏" : "全屏"}>
          <button
            className="playback-controls__btn"
            type="button"
            disabled={disabled}
            onClick={handleToggleFullscreen}
            aria-label={isFullscreen ? "退出全屏" : "全屏"}
          >
            <Maximize size={16} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
