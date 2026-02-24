/**
 * 屏幕录制全屏覆盖层
 *
 * 实现完整的屏幕录制流程（UI/交互参考 CameraRecordOverlay）：
 * - idle: 提示选择屏幕 + 设置按钮（麦克风开关）
 * - recording: 录制时长 + 屏幕预览 + 控制按钮
 * - paused: 暂停状态
 * - stopped/preview: 视频回放 + 导出按钮
 * - confirm-retake: 确认重拍对话框
 * - confirm-close: 确认关闭对话框
 *
 * 与相机录制的区别：
 * - 使用 getDisplayMedia（由浏览器弹出屏幕选择器）
 * - 没有倒计时
 * - 没有 idle 预览画面
 * - 用户可通过浏览器 UI 停止共享（需监听 track ended）
 * - 视频不做镜像翻转
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Popover, Dialog } from "radix-ui";
import {
  X,
  Settings,
  Square,
  Pause,
  Play,
  RefreshCcw,
  Upload,
  Plus,
  Check,
  Mic,
  MicOff,
  Monitor,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useRecorder,
  useMediaDevices,
  startScreenRecording,
  type RecordingResult,
  type RecordingHandle,
} from "@vitecut/record";
import "./ScreenRecordOverlay.css";

/** 组件 Props */
type ScreenRecordOverlayProps = {
  /** 关闭覆盖层回调 */
  onClose: () => void;
  /** 录制结束后将结果添加到时间轴 */
  onAddToTimeline?: (result: RecordingResult, name: string) => void;
  /** 录制结束后将结果添加到媒体库 */
  onAddToLibrary?: (result: RecordingResult, name: string) => void;
};

/** 最大录制时长：15 分钟 */
const MAX_RECORDING_DURATION_MS = 15 * 60 * 1000;

/** 将毫秒格式化为 mm:ss */
const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

/**
 * 屏幕录制全屏覆盖层组件。
 *
 * 状态机流转：idle → recording ⇄ paused → stopped
 * 没有倒计时阶段——点击录制时浏览器直接弹出屏幕选择器。
 * 使用 useRecorder 通用状态机 + startScreenRecording 进行屏幕采集。
 */
export function ScreenRecordOverlay({
  onClose,
  onAddToTimeline,
  onAddToLibrary,
}: ScreenRecordOverlayProps) {
  const [showConfirmRetake, setShowConfirmRetake] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [recordingName, setRecordingName] = useState("屏幕录制");
  const [isPlaying, setIsPlaying] = useState(false);
  /** 回放时的当前播放时间（毫秒） */
  const [playbackCurrentMs, setPlaybackCurrentMs] = useState(0);
  /** 是否同时录制麦克风音频 */
  const [withAudio, setWithAudio] = useState(false);
  /** 是否采集系统音频（标签页/桌面声音） */
  const [withSystemAudio, setWithSystemAudio] = useState(true);

  /** recording 阶段的屏幕预览 <video> */
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  /** stopped 阶段的回放 <video> */
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  /** 录制结果的 Object URL */
  const objectUrlRef = useRef<string | null>(null);
  /** 当前录制的 handle 引用，用于注册 onStreamEnded */
  const handleRef = useRef<RecordingHandle | null>(null);

  /** 释放 createObjectURL 创建的 URL，防止内存泄漏 */
  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      revokeObjectUrl();
    };
  }, [revokeObjectUrl]);

  const mic = useMediaDevices("audioinput", { requestPermissionOnLoad: false });

  /**
   * 录制启动函数，传给 useRecorder。
   * 调用 startScreenRecording 会触发浏览器的屏幕选择弹窗。
   */
  const startRecording = useCallback(async () => {
    const handle = await startScreenRecording({
      withAudio,
      audioConstraints:
        withAudio && mic.selectedId
          ? { deviceId: { exact: mic.selectedId } }
          : undefined,
      displayMediaOptions: {
        video: {
          displaySurface: "monitor",
          frameRate: 30,
        },
        audio: withSystemAudio,
      },
      videoBitsPerSecond: 8_000_000,
    });

    handleRef.current = handle;
    return handle;
  }, [mic.selectedId, withAudio, withSystemAudio]);

  /** 通用录制状态机（无倒计时） */
  const recorder = useRecorder({
    startRecording,
    maxDurationMs: MAX_RECORDING_DURATION_MS,
    countdownSeconds: 0,
  });

  /** 标记是否已注册 onStreamEnded，避免 effect 重跑时重复绑定 */
  const streamEndedBoundRef = useRef(false);

  /**
   * 监听屏幕共享流结束（用户通过浏览器 UI 点击"停止共享"）。
   * 仅在首次进入 recording 阶段时注册一次。
   */
  useEffect(() => {
    if (
      recorder.phase === "recording" &&
      handleRef.current?.onStreamEnded &&
      !streamEndedBoundRef.current
    ) {
      streamEndedBoundRef.current = true;
      handleRef.current.onStreamEnded(() => {
        recorder.stop();
      });
    }
    if (recorder.phase === "idle" || recorder.phase === "stopped") {
      streamEndedBoundRef.current = false;
    }
  }, [recorder.phase, recorder.stop]);

  /** 将录制流绑定到 preview <video> */
  useEffect(() => {
    const videoEl = previewVideoRef.current;
    if (!videoEl) return;

    if (
      (recorder.phase === "recording" || recorder.phase === "paused") &&
      recorder.stream
    ) {
      videoEl.srcObject = recorder.stream;
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [recorder.phase, recorder.stream]);

  /** 录制结束后，从 Blob 创建 Object URL 并绑定到回放 <video> */
  useEffect(() => {
    if (recorder.phase === "stopped" && recorder.result) {
      revokeObjectUrl();
      const url = URL.createObjectURL(recorder.result.blob);
      objectUrlRef.current = url;
      if (playbackVideoRef.current) {
        playbackVideoRef.current.src = url;
      }
    }
  }, [recorder.phase, recorder.result, revokeObjectUrl]);

  /** 切换回放视频的播放/暂停状态 */
  const handlePlayPause = useCallback(() => {
    if (!playbackVideoRef.current) return;
    if (isPlaying) {
      playbackVideoRef.current.pause();
      setIsPlaying(false);
    } else {
      playbackVideoRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  /** 回放进度追踪与结束重置 */
  useEffect(() => {
    const video = playbackVideoRef.current;
    if (!video || !recorder.result) return;

    const handleTimeUpdate = () => {
      setPlaybackCurrentMs(video.currentTime * 1000);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackCurrentMs(0);
      if (video) video.currentTime = 0;
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [recorder.result]);

  /** 关闭按钮：idle 直接关闭，其他阶段弹出确认对话框 */
  const handleClose = () => {
    if (recorder.phase === "idle") {
      onClose();
    } else {
      setShowConfirmClose(true);
    }
  };

  /** 确认放弃：销毁录制器、释放资源后关闭覆盖层 */
  const handleConfirmClose = () => {
    recorder.destroy();
    handleRef.current = null;
    revokeObjectUrl();
    if (playbackVideoRef.current) {
      playbackVideoRef.current.pause();
      playbackVideoRef.current.src = "";
    }
    onClose();
  };

  /** 重新录制：重置录制器、清理回放资源、恢复默认状态 */
  const handleRetake = () => {
    recorder.reset();
    handleRef.current = null;
    setShowConfirmRetake(false);
    setIsPlaying(false);
    setPlaybackCurrentMs(0);
    setRecordingName("屏幕录制");
    revokeObjectUrl();
    if (playbackVideoRef.current) {
      playbackVideoRef.current.pause();
      playbackVideoRef.current.src = "";
    }
  };

  /** 将录制结果添加到时间轴 */
  const handleAddToTimeline = () => {
    if (recorder.result && onAddToTimeline) {
      onAddToTimeline(recorder.result, recordingName.trim() || "屏幕录制");
      onClose();
    }
  };

  /** 将录制结果添加到媒体库 */
  const handleAddToLibrary = () => {
    if (recorder.result && onAddToLibrary) {
      onAddToLibrary(recorder.result, recordingName.trim() || "屏幕录制");
      onClose();
    }
  };

  /** 点击开始录制：直接启动（无倒计时），startRecording 会弹出屏幕选择器 */
  const handleStartRecording = () => {
    recorder.startCountdown();
  };

  const phase = recorder.phase;

  return (
    <div className="screen-record-overlay">
      <button
        className="screen-record-overlay__close"
        onClick={handleClose}
        aria-label="关闭"
      >
        <X size={20} />
      </button>

      {/* idle 阶段 */}
      {phase === "idle" && (
        <>
          <div className="screen-record-overlay__idle-content">
            <div className="screen-record-overlay__idle-icon">
              <Monitor size={64} />
            </div>
            <h2 className="screen-record-overlay__idle-title">屏幕录制</h2>
            <p className="screen-record-overlay__idle-desc">
              点击下方按钮开始录制，浏览器将提示您选择要共享的屏幕或窗口
            </p>
          </div>
          <div className="screen-record-overlay__idle-controls">
            <button
              className="screen-record-overlay__record-btn"
              onClick={handleStartRecording}
              aria-label="开始录制"
            >
              <div className="screen-record-overlay__record-btn-ring" />
              <div className="screen-record-overlay__record-btn-inner" />
            </button>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  className="screen-record-overlay__settings-btn"
                  aria-label="设置"
                >
                  <Settings size={20} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="screen-record-overlay__popover"
                  side="top"
                  sideOffset={8}
                >
                  <div className="screen-record-overlay__popover-title">
                    系统音频
                  </div>
                  <div className="screen-record-overlay__device-list">
                    <button
                      className={`screen-record-overlay__device-item ${
                        withSystemAudio
                          ? "screen-record-overlay__device-item--selected"
                          : ""
                      }`}
                      onClick={() => setWithSystemAudio(true)}
                    >
                      {withSystemAudio && <Check size={16} />}
                      <Volume2 size={16} />
                      <span>录制系统声音</span>
                    </button>
                    <button
                      className={`screen-record-overlay__device-item ${
                        !withSystemAudio
                          ? "screen-record-overlay__device-item--selected"
                          : ""
                      }`}
                      onClick={() => setWithSystemAudio(false)}
                    >
                      {!withSystemAudio && <Check size={16} />}
                      <VolumeX size={16} />
                      <span>不录制系统声音</span>
                    </button>
                  </div>
                  <div className="screen-record-overlay__popover-divider" />
                  <div className="screen-record-overlay__popover-title">
                    麦克风
                  </div>
                  <div className="screen-record-overlay__device-list">
                    <button
                      className={`screen-record-overlay__device-item ${
                        !withAudio
                          ? "screen-record-overlay__device-item--selected"
                          : ""
                      }`}
                      onClick={() => setWithAudio(false)}
                    >
                      {!withAudio && <Check size={16} />}
                      <MicOff size={16} />
                      <span>不录音</span>
                    </button>
                    {mic.devices.map((device) => (
                      <button
                        key={device.deviceId}
                        className={`screen-record-overlay__device-item ${
                          withAudio && device.deviceId === mic.selectedId
                            ? "screen-record-overlay__device-item--selected"
                            : ""
                        }`}
                        onClick={() => {
                          setWithAudio(true);
                          mic.setSelectedId(device.deviceId);
                        }}
                      >
                        {withAudio && device.deviceId === mic.selectedId && (
                          <Check size={16} />
                        )}
                        <Mic size={16} />
                        <span>{device.label}</span>
                      </button>
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </>
      )}

      {/* countdown 阶段：等待用户在浏览器弹窗中选择屏幕 */}
      {phase === "countdown" && (
        <div className="screen-record-overlay__idle-content">
          <div className="screen-record-overlay__idle-icon">
            <Monitor size={64} />
          </div>
          <h2 className="screen-record-overlay__idle-title">
            请选择要共享的屏幕
          </h2>
          <p className="screen-record-overlay__idle-desc">
            浏览器正在弹出屏幕选择窗口，请在弹窗中选择要录制的屏幕或窗口
          </p>
        </div>
      )}

      {/* recording / paused 阶段 */}
      {(phase === "recording" || phase === "paused") && (
        <>
          <div className="screen-record-overlay__recording-header">
            <div
              className={`screen-record-overlay__recording-indicator ${
                phase === "paused"
                  ? "screen-record-overlay__recording-indicator--paused"
                  : ""
              }`}
            />
            <span className="screen-record-overlay__recording-time">
              {formatDuration(recorder.elapsedMs)} /{" "}
              {formatDuration(MAX_RECORDING_DURATION_MS)}
            </span>
          </div>
          <div className="screen-record-overlay__preview-container">
            <video
              ref={previewVideoRef}
              className="screen-record-overlay__video"
              autoPlay
              playsInline
              muted
            />
          </div>
          <div className="screen-record-overlay__controls">
            <button
              className="screen-record-overlay__control-btn"
              onClick={() => {
                recorder.reset();
                handleRef.current = null;
                recorder.startCountdown();
              }}
              aria-label="重新录制"
            >
              <RefreshCcw size={20} />
            </button>
            <button
              className="screen-record-overlay__control-btn screen-record-overlay__control-btn--stop"
              onClick={recorder.stop}
              aria-label="停止录制"
            >
              <Square size={20} fill="currentColor" />
            </button>
            {phase === "recording" ? (
              <button
                className="screen-record-overlay__control-btn"
                onClick={recorder.pause}
                aria-label="暂停录制"
              >
                <Pause size={20} />
              </button>
            ) : (
              <button
                className="screen-record-overlay__control-btn"
                onClick={recorder.resume}
                aria-label="继续录制"
              >
                <Play size={20} fill="currentColor" />
              </button>
            )}
          </div>
        </>
      )}

      {/* stopped / preview 阶段 */}
      {phase === "stopped" && recorder.result && (
        <>
          <div className="screen-record-overlay__stopped-header">
            <input
              type="text"
              className="screen-record-overlay__stopped-title"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              placeholder="录制名称"
              aria-label="录制名称"
            />
            <div className="screen-record-overlay__stopped-time">
              {formatDuration(playbackCurrentMs)} /{" "}
              {formatDuration(recorder.result.durationMs)}
            </div>
          </div>
          <div className="screen-record-overlay__preview-container">
            <video
              ref={playbackVideoRef}
              className="screen-record-overlay__video"
              playsInline
              onClick={handlePlayPause}
            />
            {!isPlaying && (
              <button
                className="screen-record-overlay__play-overlay"
                onClick={handlePlayPause}
                aria-label="播放"
              >
                <Play size={48} fill="currentColor" />
              </button>
            )}
          </div>
          <div className="screen-record-overlay__preview-controls">
            <button
              className="screen-record-overlay__action-btn screen-record-overlay__action-btn--retake"
              onClick={() => setShowConfirmRetake(true)}
              aria-label="重新录制"
            >
              <RefreshCcw size={20} />
            </button>
            <div className="screen-record-overlay__action-group">
              <button
                className="screen-record-overlay__action-btn screen-record-overlay__action-btn--secondary"
                onClick={handleAddToLibrary}
                aria-label="添加到媒体库"
              >
                <Upload size={16} />
                <span>添加到媒体库</span>
              </button>
              <button
                className="screen-record-overlay__action-btn screen-record-overlay__action-btn--primary"
                onClick={handleAddToTimeline}
                aria-label="添加到时间轴"
              >
                <Plus size={16} />
                <span>添加到时间轴</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 确认重拍对话框 */}
      <Dialog.Root open={showConfirmRetake} onOpenChange={setShowConfirmRetake}>
        <Dialog.Portal>
          <Dialog.Overlay className="screen-record-overlay__dialog-overlay" />
          <Dialog.Content className="screen-record-overlay__dialog">
            <Dialog.Title className="screen-record-overlay__dialog-title">
              重新录制?
            </Dialog.Title>
            <Dialog.Description className="screen-record-overlay__dialog-description">
              如果选择重录，当前录制将被删除。
            </Dialog.Description>
            <div className="screen-record-overlay__dialog-actions">
              <Dialog.Close asChild>
                <button className="screen-record-overlay__dialog-btn screen-record-overlay__dialog-btn--cancel">
                  停留此处
                </button>
              </Dialog.Close>
              <button
                className="screen-record-overlay__dialog-btn screen-record-overlay__dialog-btn--confirm"
                onClick={handleRetake}
              >
                重拍
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 确认关闭对话框 */}
      <Dialog.Root open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="screen-record-overlay__dialog-overlay" />
          <Dialog.Content className="screen-record-overlay__dialog">
            <Dialog.Title className="screen-record-overlay__dialog-title">
              放弃录制?
            </Dialog.Title>
            <Dialog.Description className="screen-record-overlay__dialog-description">
              如果放弃，当前录制将丢失。
            </Dialog.Description>
            <div className="screen-record-overlay__dialog-actions">
              <Dialog.Close asChild>
                <button className="screen-record-overlay__dialog-btn screen-record-overlay__dialog-btn--cancel">
                  继续录制
                </button>
              </Dialog.Close>
              <button
                className="screen-record-overlay__dialog-btn screen-record-overlay__dialog-btn--danger"
                onClick={handleConfirmClose}
              >
                放弃
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
