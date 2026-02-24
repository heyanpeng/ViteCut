/**
 * 相机录制全屏覆盖层
 *
 * 实现完整的摄像头录制流程（UI/交互参考 AudioRecordOverlay）：
 * - idle: 摄像头实时预览 + 录制按钮 + 设置按钮
 * - countdown: 倒计时 3/2/1
 * - recording: 录制时长 + 实时视频预览 + 控制按钮
 * - paused: 暂停状态
 * - stopped/preview: 视频回放 + 导出按钮
 * - confirm-retake: 确认重拍对话框
 * - confirm-close: 确认关闭对话框
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
} from "lucide-react";
import {
  useRecorder,
  useMediaDevices,
  startCameraRecording,
  type RecordingResult,
} from "@vitecut/record";
import "./CameraRecordOverlay.css";

/** 组件 Props */
type CameraRecordOverlayProps = {
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
 * 相机录制全屏覆盖层组件。
 *
 * 状态机流转：idle → countdown → recording ⇄ paused → stopped
 * 使用 useRecorder 通用状态机 + startCameraRecording 进行摄像头采集，
 * 通过 useMediaDevices 管理摄像头和麦克风设备列表及选中状态。
 */
export function CameraRecordOverlay({
  onClose,
  onAddToTimeline,
  onAddToLibrary,
}: CameraRecordOverlayProps) {
  const [showConfirmRetake, setShowConfirmRetake] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [recordingName, setRecordingName] = useState("摄像头录制");
  const [isPlaying, setIsPlaying] = useState(false);
  /** 回放时的当前播放时间（毫秒），用于 UI 显示 */
  const [playbackCurrentMs, setPlaybackCurrentMs] = useState(0);
  /** 是否同时录制麦克风音频 */
  const [withAudio, setWithAudio] = useState(true);

  /** idle/recording 阶段的实时预览 <video> */
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  /** stopped 阶段的回放 <video> */
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  /** 录制结果的 Object URL，需在不用时释放避免内存泄漏 */
  const objectUrlRef = useRef<string | null>(null);
  /** idle 阶段独立拉取的摄像头预览流（未开始录制时也能看到画面） */
  const [idleCameraStream, setIdleCameraStream] = useState<MediaStream | null>(
    null,
  );
  const [cameraPreviewError, setCameraPreviewError] = useState<string | null>(
    null,
  );
  const idleCameraStreamRef = useRef<MediaStream | null>(null);

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

  // 设备枚举：摄像头和麦克风，初始不弹权限弹窗
  const camera = useMediaDevices("videoinput", {
    requestPermissionOnLoad: false,
  });
  const mic = useMediaDevices("audioinput", { requestPermissionOnLoad: false });
  const cameraRefreshRef = useRef(camera.refresh);
  cameraRefreshRef.current = camera.refresh;

  /**
   * 录制启动函数，传给 useRecorder。
   * 先停止 idle 预览流（释放设备），再通过 startCameraRecording 重新采集。
   */
  const startRecording = useCallback(() => {
    const stream = idleCameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      idleCameraStreamRef.current = null;
      setIdleCameraStream(null);
    }

    return startCameraRecording({
      withAudio,
      videoConstraints: camera.selectedId
        ? { deviceId: { exact: camera.selectedId } }
        : undefined,
      audioConstraints:
        withAudio && mic.selectedId
          ? { deviceId: { exact: mic.selectedId } }
          : undefined,
    });
  }, [camera.selectedId, mic.selectedId, withAudio]);

  /** 通用录制状态机（倒计时、时长追踪、暂停/恢复/停止等） */
  const recorder = useRecorder({
    startRecording,
    maxDurationMs: MAX_RECORDING_DURATION_MS,
    countdownSeconds: 3,
  });

  const stopIdleStream = useCallback(() => {
    const stream = idleCameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      idleCameraStreamRef.current = null;
      setIdleCameraStream(null);
    }
  }, []);

  /**
   * idle 阶段：拉取摄像头流用于实时预览（未开始录制也能看到画面）。
   * 切换摄像头设备或离开 idle 阶段时自动停止旧流。
   * 先尝试 exact 匹配选中设备，失败后降级为 ideal。
   */
  useEffect(() => {
    // 非 idle 阶段不需要独立预览流
    switch (recorder.phase) {
      case "countdown":
        // 倒计时阶段保留预览流（画面仍在显示）
        return;
      case "recording":
      case "paused":
      case "stopped":
        // 录制/暂停/停止阶段：流已由 recorder 接管或不再需要
        stopIdleStream();
        return;
    }

    // idle 阶段：拉取新的摄像头预览流
    stopIdleStream();
    setCameraPreviewError(null);

    const constraints: MediaTrackConstraints = camera.selectedId
      ? { deviceId: { exact: camera.selectedId } }
      : {};

    navigator.mediaDevices
      .getUserMedia({ video: constraints, audio: false })
      .then((stream) => {
        idleCameraStreamRef.current = stream;
        setIdleCameraStream(stream);
        cameraRefreshRef.current({ requestPermission: true });
      })
      .catch(() => {
        if (camera.selectedId) {
          navigator.mediaDevices
            .getUserMedia({
              video: { deviceId: { ideal: camera.selectedId } },
              audio: false,
            })
            .then((stream) => {
              idleCameraStreamRef.current = stream;
              setIdleCameraStream(stream);
              cameraRefreshRef.current({ requestPermission: true });
            })
            .catch((err) => {
              console.error("获取摄像头预览失败:", err);
              setCameraPreviewError("无法访问摄像头，请检查权限");
            });
        } else {
          setCameraPreviewError("无法访问摄像头，请检查权限");
        }
      });

    return () => {
      stopIdleStream();
    };
  }, [recorder.phase, camera.selectedId, stopIdleStream]);

  /** 将当前活跃流（idle 预览流 / 录制流）绑定到 preview <video> 元素 */
  useEffect(() => {
    const videoEl = previewVideoRef.current;
    if (!videoEl) return;

    const activeStream =
      recorder.phase === "idle"
        ? idleCameraStream
        : recorder.phase === "recording" || recorder.phase === "paused"
          ? recorder.stream
          : null;

    if (activeStream) {
      videoEl.srcObject = activeStream;
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [recorder.phase, recorder.stream, idleCameraStream]);

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

  /** 关闭按钮：idle 显式停止预览流后关闭，其他阶段弹出确认对话框 */
  const handleClose = () => {
    if (recorder.phase === "idle") {
      stopIdleStream();
      onClose();
    } else {
      setShowConfirmClose(true);
    }
  };

  /** 确认放弃：销毁录制器、释放资源后关闭覆盖层 */
  const handleConfirmClose = () => {
    recorder.destroy();
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
    setShowConfirmRetake(false);
    setIsPlaying(false);
    setPlaybackCurrentMs(0);
    setRecordingName("摄像头录制");
    revokeObjectUrl();
    if (playbackVideoRef.current) {
      playbackVideoRef.current.pause();
      playbackVideoRef.current.src = "";
    }
  };

  /** 将录制结果添加到时间轴 */
  const handleAddToTimeline = () => {
    if (recorder.result && onAddToTimeline) {
      onAddToTimeline(recorder.result, recordingName.trim() || "摄像头录制");
      onClose();
    }
  };

  /** 将录制结果添加到媒体库 */
  const handleAddToLibrary = () => {
    if (recorder.result && onAddToLibrary) {
      onAddToLibrary(recorder.result, recordingName.trim() || "摄像头录制");
      onClose();
    }
  };

  const phase = recorder.phase;
  const showCloseButton = phase !== "countdown";

  return (
    <div className="camera-record-overlay">
      {showCloseButton && (
        <button
          className="camera-record-overlay__close"
          onClick={handleClose}
          aria-label="关闭"
        >
          <X size={20} />
        </button>
      )}

      {/* idle 阶段 */}
      {phase === "idle" && (
        <>
          <div className="camera-record-overlay__preview-container">
            <video
              ref={previewVideoRef}
              className="camera-record-overlay__video"
              autoPlay
              playsInline
              muted
            />
            {cameraPreviewError && (
              <div className="camera-record-overlay__preview-error">
                {cameraPreviewError}
              </div>
            )}
          </div>
          <div className="camera-record-overlay__idle-controls">
            <button
              className="camera-record-overlay__record-btn"
              onClick={recorder.startCountdown}
              aria-label="开始录制"
            >
              <div className="camera-record-overlay__record-btn-ring" />
              <div className="camera-record-overlay__record-btn-inner" />
            </button>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  className="camera-record-overlay__settings-btn"
                  aria-label="设置"
                >
                  <Settings size={20} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="camera-record-overlay__popover"
                  side="top"
                  sideOffset={8}
                >
                  <div className="camera-record-overlay__popover-title">
                    摄像头
                  </div>
                  <div className="camera-record-overlay__device-list">
                    {camera.devices.map((device) => (
                      <button
                        key={device.deviceId}
                        className={`camera-record-overlay__device-item ${
                          device.deviceId === camera.selectedId
                            ? "camera-record-overlay__device-item--selected"
                            : ""
                        }`}
                        onClick={() => camera.setSelectedId(device.deviceId)}
                      >
                        {device.deviceId === camera.selectedId && (
                          <Check size={16} />
                        )}
                        <span>{device.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="camera-record-overlay__popover-divider" />
                  <div className="camera-record-overlay__popover-title">
                    麦克风
                  </div>
                  <div className="camera-record-overlay__device-list">
                    <button
                      className={`camera-record-overlay__device-item ${
                        !withAudio
                          ? "camera-record-overlay__device-item--selected"
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
                        className={`camera-record-overlay__device-item ${
                          withAudio && device.deviceId === mic.selectedId
                            ? "camera-record-overlay__device-item--selected"
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

      {/* countdown 阶段 */}
      {phase === "countdown" && recorder.countdownRemaining > 0 && (
        <div
          className="camera-record-overlay__countdown"
          onClick={recorder.cancelCountdown}
        >
          <div className="camera-record-overlay__countdown-number">
            {recorder.countdownRemaining}
          </div>
          <div className="camera-record-overlay__countdown-hint">
            单击任意位置以取消
          </div>
        </div>
      )}

      {/* recording / paused 阶段 */}
      {(phase === "recording" || phase === "paused") && (
        <>
          <div className="camera-record-overlay__recording-header">
            <div
              className={`camera-record-overlay__recording-indicator ${
                phase === "paused"
                  ? "camera-record-overlay__recording-indicator--paused"
                  : ""
              }`}
            />
            <span className="camera-record-overlay__recording-time">
              {formatDuration(recorder.elapsedMs)} /{" "}
              {formatDuration(MAX_RECORDING_DURATION_MS)}
            </span>
          </div>
          <div className="camera-record-overlay__preview-container">
            <video
              ref={previewVideoRef}
              className="camera-record-overlay__video"
              autoPlay
              playsInline
              muted
            />
          </div>
          <div className="camera-record-overlay__controls">
            <button
              className="camera-record-overlay__control-btn"
              onClick={() => {
                recorder.reset();
                recorder.startCountdown();
              }}
              aria-label="重新录制"
            >
              <RefreshCcw size={20} />
            </button>
            <button
              className="camera-record-overlay__control-btn camera-record-overlay__control-btn--stop"
              onClick={recorder.stop}
              aria-label="停止录制"
            >
              <Square size={20} fill="currentColor" />
            </button>
            {phase === "recording" ? (
              <button
                className="camera-record-overlay__control-btn"
                onClick={recorder.pause}
                aria-label="暂停录制"
              >
                <Pause size={20} />
              </button>
            ) : (
              <button
                className="camera-record-overlay__control-btn"
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
          <div className="camera-record-overlay__stopped-header">
            <input
              type="text"
              className="camera-record-overlay__stopped-title"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              placeholder="录制名称"
              aria-label="录制名称"
            />
            <div className="camera-record-overlay__stopped-time">
              {formatDuration(playbackCurrentMs)} /{" "}
              {formatDuration(recorder.result.durationMs)}
            </div>
          </div>
          <div className="camera-record-overlay__preview-container">
            <video
              ref={playbackVideoRef}
              className="camera-record-overlay__video"
              playsInline
              onClick={handlePlayPause}
            />
            {!isPlaying && (
              <button
                className="camera-record-overlay__play-overlay"
                onClick={handlePlayPause}
                aria-label="播放"
              >
                <Play size={48} fill="currentColor" />
              </button>
            )}
          </div>
          <div className="camera-record-overlay__preview-controls">
            <button
              className="camera-record-overlay__action-btn camera-record-overlay__action-btn--retake"
              onClick={() => setShowConfirmRetake(true)}
              aria-label="重新录制"
            >
              <RefreshCcw size={20} />
            </button>
            <div className="camera-record-overlay__action-group">
              <button
                className="camera-record-overlay__action-btn camera-record-overlay__action-btn--secondary"
                onClick={handleAddToLibrary}
                aria-label="添加到媒体库"
              >
                <Upload size={16} />
                <span>添加到媒体库</span>
              </button>
              <button
                className="camera-record-overlay__action-btn camera-record-overlay__action-btn--primary"
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
          <Dialog.Overlay className="camera-record-overlay__dialog-overlay" />
          <Dialog.Content className="camera-record-overlay__dialog">
            <Dialog.Title className="camera-record-overlay__dialog-title">
              重新录制?
            </Dialog.Title>
            <Dialog.Description className="camera-record-overlay__dialog-description">
              如果选择重录，当前录制将被删除。
            </Dialog.Description>
            <div className="camera-record-overlay__dialog-actions">
              <Dialog.Close asChild>
                <button className="camera-record-overlay__dialog-btn camera-record-overlay__dialog-btn--cancel">
                  停留此处
                </button>
              </Dialog.Close>
              <button
                className="camera-record-overlay__dialog-btn camera-record-overlay__dialog-btn--confirm"
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
          <Dialog.Overlay className="camera-record-overlay__dialog-overlay" />
          <Dialog.Content className="camera-record-overlay__dialog">
            <Dialog.Title className="camera-record-overlay__dialog-title">
              放弃录制?
            </Dialog.Title>
            <Dialog.Description className="camera-record-overlay__dialog-description">
              如果放弃，当前录制将丢失。
            </Dialog.Description>
            <div className="camera-record-overlay__dialog-actions">
              <Dialog.Close asChild>
                <button className="camera-record-overlay__dialog-btn camera-record-overlay__dialog-btn--cancel">
                  继续录制
                </button>
              </Dialog.Close>
              <button
                className="camera-record-overlay__dialog-btn camera-record-overlay__dialog-btn--danger"
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
