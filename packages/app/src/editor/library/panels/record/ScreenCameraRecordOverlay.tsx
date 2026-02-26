/**
 * 屏幕 + 摄像头同时录制全屏覆盖层
 *
 * 同时采集屏幕（getDisplayMedia）与摄像头（getUserMedia），合成画中画后录制。
 * 流程与 ScreenRecordOverlay 一致：idle → countdown（选屏）→ recording → stopped。
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
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useRecorder,
  useMediaDevices,
  startScreenCameraRecording,
  type RecordingResult,
  type RecordingHandle,
} from "@vitecut/record";
import "./ScreenRecordOverlay.css";

type ScreenCameraRecordOverlayProps = {
  onClose: () => void;
  onAddToTimeline?: (result: RecordingResult, name: string) => void;
  onAddToLibrary?: (result: RecordingResult, name: string) => void;
};

const MAX_RECORDING_DURATION_MS = 15 * 60 * 1000;

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export function ScreenCameraRecordOverlay({
  onClose,
  onAddToTimeline,
  onAddToLibrary,
}: ScreenCameraRecordOverlayProps) {
  const [showConfirmRetake, setShowConfirmRetake] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [recordingName, setRecordingName] = useState("屏幕和摄像头录制");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCurrentMs, setPlaybackCurrentMs] = useState(0);
  const [withAudio, setWithAudio] = useState(false);
  const [withSystemAudio, setWithSystemAudio] = useState(true);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const handleRef = useRef<RecordingHandle | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokeObjectUrl(), [revokeObjectUrl]);

  const camera = useMediaDevices("videoinput", {
    requestPermissionOnLoad: false,
  });
  const mic = useMediaDevices("audioinput", { requestPermissionOnLoad: false });

  const startRecording = useCallback(async () => {
    const handle = await startScreenCameraRecording({
      withAudio,
      withSystemAudio,
      audioConstraints:
        withAudio && mic.selectedId
          ? { deviceId: { exact: mic.selectedId } }
          : undefined,
      videoConstraints: camera.selectedId
        ? {
            deviceId: { exact: camera.selectedId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : undefined,
      displayMediaOptions: {
        video: { displaySurface: "monitor", frameRate: 30 },
      },
      videoBitsPerSecond: 8_000_000,
      cameraSizeRatio: 0.2,
    });

    handleRef.current = handle;
    return handle;
  }, [camera.selectedId, mic.selectedId, withAudio, withSystemAudio]);

  const recorder = useRecorder({
    startRecording,
    maxDurationMs: MAX_RECORDING_DURATION_MS,
    countdownSeconds: 0,
  });

  const streamEndedBoundRef = useRef(false);
  useEffect(() => {
    if (
      recorder.phase === "recording" &&
      handleRef.current?.onStreamEnded &&
      !streamEndedBoundRef.current
    ) {
      streamEndedBoundRef.current = true;
      handleRef.current.onStreamEnded(() => recorder.stop());
    }
    if (recorder.phase === "idle" || recorder.phase === "stopped") {
      streamEndedBoundRef.current = false;
    }
  }, [recorder.phase, recorder.stop]);

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

  useEffect(() => {
    const video = playbackVideoRef.current;
    if (!video || !recorder.result) return;
    const handleTimeUpdate = () =>
      setPlaybackCurrentMs(video.currentTime * 1000);
    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackCurrentMs(0);
      video.currentTime = 0;
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [recorder.result]);

  const handleClose = () => {
    if (recorder.phase === "idle") {
      onClose();
    } else {
      setShowConfirmClose(true);
    }
  };

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

  const handleRetake = () => {
    recorder.reset();
    handleRef.current = null;
    setShowConfirmRetake(false);
    setIsPlaying(false);
    setPlaybackCurrentMs(0);
    setRecordingName("屏幕和摄像头录制");
    revokeObjectUrl();
    if (playbackVideoRef.current) {
      playbackVideoRef.current.pause();
      playbackVideoRef.current.src = "";
    }
  };

  const handleAddToTimeline = () => {
    if (recorder.result && onAddToTimeline) {
      onAddToTimeline(
        recorder.result,
        recordingName.trim() || "屏幕和摄像头录制"
      );
      onClose();
    }
  };

  const handleAddToLibrary = () => {
    if (recorder.result && onAddToLibrary) {
      onAddToLibrary(
        recorder.result,
        recordingName.trim() || "屏幕和摄像头录制"
      );
      onClose();
    }
  };

  const handleStartRecording = () => recorder.startCountdown();

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

      {phase === "idle" && (
        <>
          <div className="screen-record-overlay__idle-content">
            <div className="screen-record-overlay__idle-icon">
              <Monitor size={48} style={{ marginRight: 8 }} />
              <Video size={48} />
            </div>
            <h2 className="screen-record-overlay__idle-title">
              屏幕和摄像头录制
            </h2>
            <p className="screen-record-overlay__idle-desc">
              点击开始后，先选择要共享的屏幕，再授权摄像头，将同时录制屏幕画面与摄像头画中画
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
                    摄像头
                  </div>
                  <div className="screen-record-overlay__device-list">
                    {camera.devices.length === 0 ? (
                      <div
                        className="screen-record-overlay__device-item"
                        style={{ opacity: 0.7 }}
                      >
                        <span>暂无设备，开始录制时将使用默认摄像头</span>
                      </div>
                    ) : (
                      camera.devices.map((device) => (
                        <button
                          key={device.deviceId}
                          className={`screen-record-overlay__device-item ${
                            camera.selectedId === device.deviceId
                              ? "screen-record-overlay__device-item--selected"
                              : ""
                          }`}
                          onClick={() => camera.setSelectedId(device.deviceId)}
                        >
                          {camera.selectedId === device.deviceId && (
                            <Check size={16} />
                          )}
                          <Video size={16} />
                          <span>{device.label}</span>
                        </button>
                      ))
                    )}
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

      {phase === "countdown" && (
        <div className="screen-record-overlay__idle-content">
          <div className="screen-record-overlay__idle-icon">
            <Monitor size={64} />
          </div>
          <h2 className="screen-record-overlay__idle-title">
            请选择要共享的屏幕
          </h2>
          <p className="screen-record-overlay__idle-desc">
            在浏览器弹窗中选择要录制的屏幕或窗口，选择后将自动开启摄像头
          </p>
        </div>
      )}

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
