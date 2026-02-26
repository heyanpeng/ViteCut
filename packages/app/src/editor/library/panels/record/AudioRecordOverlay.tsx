/**
 * 音频录制全屏覆盖层
 *
 * 实现完整的音频录制流程：
 * - idle: 实时麦克风信号波形 + 录制按钮 + 设置按钮
 * - countdown: 倒计时 3/2/1
 * - recording: 录制时长 + 绿色实时波形 + 控制按钮
 * - paused: 暂停状态
 * - stopped/preview: 静态波形 + 播放控制 + 导出按钮
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
} from "lucide-react";
import {
  useRecorder,
  useWavesurferWaveform,
  useMediaDevices,
  startAudioRecording,
  type RecordingResult,
} from "@vitecut/record";
import "./AudioRecordOverlay.css";

type AudioRecordOverlayProps = {
  onClose: () => void;
  onAddToTimeline?: (result: RecordingResult, name: string) => void;
  onAddToLibrary?: (result: RecordingResult, name: string) => void;
};

/** 最大录制时长（毫秒） */
const MAX_RECORDING_DURATION_MS = 15 * 60 * 1000;

/** 格式化时长显示：mm:ss */
const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

/** 从 Blob 解码音频并提取峰值 */
const decodeAudioToPeaks = async (
  blob: Blob,
  targetCount: number
): Promise<number[]> => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new OfflineAudioContext(1, 1, 44100);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channels = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  const count = Math.min(targetCount, totalSamples);
  const samplesPerPeak = Math.floor(totalSamples / count);

  const channelDataArrays: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    channelDataArrays.push(audioBuffer.getChannelData(ch));
  }

  const peaks: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    let max = 0;
    const offset = i * samplesPerPeak;
    for (let j = 0; j < samplesPerPeak; j++) {
      for (let ch = 0; ch < channels; ch++) {
        const sample = channelDataArrays[ch]?.[offset + j] ?? 0;
        const abs = Math.abs(sample);
        if (abs > max) {
          max = abs;
        }
      }
    }
    peaks[i] = max;
  }

  // 归一化到 [0, 1]
  let globalMax = 0;
  for (let i = 0; i < count; i++) {
    const p = peaks[i] ?? 0;
    if (p > globalMax) {
      globalMax = p;
    }
  }
  if (globalMax > 0) {
    for (let i = 0; i < count; i++) {
      peaks[i] = (peaks[i] ?? 0) / globalMax;
    }
  }

  return peaks;
};

/** 绘制静态波形到 Canvas */
const drawStaticWaveform = (
  canvas: HTMLCanvasElement,
  peaks: number[],
  color: string = "#9ca3af"
): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = color;
  const centerY = height / 2;
  const maxBarHeight = (height - 4) / 2;

  for (let i = 0; i < peaks.length; i++) {
    const barHeight = Math.max(1, (peaks[i] ?? 0) * maxBarHeight);
    ctx.fillRect(i, centerY - barHeight, 1, barHeight * 2);
  }
};

export function AudioRecordOverlay({
  onClose,
  onAddToTimeline,
  onAddToLibrary,
}: AudioRecordOverlayProps) {
  const [showConfirmRetake, setShowConfirmRetake] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [recordingName, setRecordingName] = useState("录音音频");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const previewPeaksRef = useRef<number[] | null>(null);
  const [idleMicStream, setIdleMicStream] = useState<MediaStream | null>(null);
  const [micPreviewError, setMicPreviewError] = useState<string | null>(null);
  const idleMicStreamRef = useRef<MediaStream | null>(null);

  // 释放 createObjectURL 创建的 URL，避免内存泄漏
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

  // 设置预览 Canvas 尺寸（基于 CSS 尺寸）
  useEffect(() => {
    const updateCanvasSize = () => {
      if (previewCanvasRef.current) {
        const canvas = previewCanvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => {
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, []);

  const mic = useMediaDevices("audioinput", { requestPermissionOnLoad: false });
  const micRefreshRef = useRef(mic.refresh);
  micRefreshRef.current = mic.refresh;

  const startRecording = useCallback(() => {
    const stream = idleMicStreamRef.current;
    if (stream) {
      const cloned = stream.clone();
      stream.getTracks().forEach((t) => t.stop());
      idleMicStreamRef.current = null;
      setIdleMicStream(null);
      return startAudioRecording({ stream: cloned });
    }
    return startAudioRecording({
      constraints: mic.selectedId
        ? { deviceId: { exact: mic.selectedId } }
        : undefined,
    });
  }, [mic.selectedId]);

  const recorder = useRecorder({
    startRecording,
    maxDurationMs: MAX_RECORDING_DURATION_MS,
    countdownSeconds: 3,
  });

  // idle 阶段：单独拉取麦克风流用于波形预览（未开始录制时也能看到声音）
  useEffect(() => {
    const stopIdleStream = () => {
      const stream = idleMicStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        idleMicStreamRef.current = null;
        setIdleMicStream(null);
      }
    };

    if (recorder.phase !== "idle") {
      setMicPreviewError(null);
      if (recorder.phase === "countdown") {
        return;
      }
      if (recorder.phase === "recording" || recorder.phase === "stopped") {
        idleMicStreamRef.current = null;
        setIdleMicStream(null);
        return;
      }
      stopIdleStream();
      return;
    }

    stopIdleStream();
    setMicPreviewError(null);

    const tryGetUserMedia = (
      constraints: MediaTrackConstraints
    ): Promise<MediaStream> => {
      return navigator.mediaDevices.getUserMedia({ audio: constraints });
    };

    const constraints: MediaTrackConstraints = mic.selectedId
      ? { deviceId: { exact: mic.selectedId } }
      : {};

    tryGetUserMedia(constraints)
      .then((stream) => {
        idleMicStreamRef.current = stream;
        setIdleMicStream(stream);
        micRefreshRef.current({ requestPermission: true });
      })
      .catch(() => {
        if (mic.selectedId) {
          tryGetUserMedia({ deviceId: { ideal: mic.selectedId } })
            .then((stream) => {
              idleMicStreamRef.current = stream;
              setIdleMicStream(stream);
              micRefreshRef.current({ requestPermission: true });
            })
            .catch((err) => {
              console.error("获取麦克风预览失败:", err);
              setMicPreviewError("无法访问麦克风，请检查权限");
            });
        } else {
          setMicPreviewError("无法访问麦克风，请检查权限");
        }
      });

    return () => {
      stopIdleStream();
    };
  }, [recorder.phase, mic.selectedId]);

  // 实时波形：idle 用预览流，recording/paused 用录制流
  const waveformStream =
    recorder.phase === "idle"
      ? idleMicStream
      : recorder.phase === "recording" || recorder.phase === "paused"
        ? recorder.stream
        : null;

  useWavesurferWaveform(waveformContainerRef, waveformStream, {
    waveColor:
      recorder.phase === "recording" || recorder.phase === "paused"
        ? "#4ade80"
        : "#9ca3af",
    barWidth: 4,
    barHeight: 1,
    barGap: 4,
  });

  // 录制完成后解码并绘制静态波形
  useEffect(() => {
    if (
      recorder.phase === "stopped" &&
      recorder.result &&
      previewCanvasRef.current
    ) {
      const canvas = previewCanvasRef.current;
      // 确保 Canvas 尺寸已设置
      if (canvas.width === 0 || canvas.height === 0) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        } else {
          // 延迟设置
          setTimeout(() => {
            if (!recorder.result) {
              return;
            }
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              canvas.width = rect.width;
              canvas.height = rect.height;
              decodeAudioToPeaks(recorder.result.blob, canvas.width)
                .then((peaks) => {
                  previewPeaksRef.current = peaks;
                  drawStaticWaveform(canvas, peaks);
                })
                .catch((err) => {
                  console.error("解码音频失败:", err);
                });
            }
          }, 100);
        }
        return;
      }

      if (!recorder.result) {
        return;
      }

      decodeAudioToPeaks(recorder.result.blob, canvas.width)
        .then((peaks) => {
          previewPeaksRef.current = peaks;
          drawStaticWaveform(canvas, peaks);
        })
        .catch((err) => {
          console.error("解码音频失败:", err);
        });
    }
  }, [recorder.phase, recorder.result]);

  // 播放回放
  const handlePlayPause = useCallback(() => {
    if (!recorder.result || !audioRef.current) {
      return;
    }

    if (!audioRef.current.src) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const url = URL.createObjectURL(recorder.result.blob);
      objectUrlRef.current = url;
      audioRef.current.src = url;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [recorder.result, isPlaying]);

  // 播放进度更新
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !recorder.result) {
      return;
    }

    const updateProgress = () => {
      if (audio.duration && audio.duration > 0) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
      if (audio) {
        audio.currentTime = 0;
      }
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [recorder.result]);

  // 绘制播放进度指示线（实时更新）
  useEffect(() => {
    if (
      recorder.phase === "stopped" &&
      previewCanvasRef.current &&
      previewPeaksRef.current
    ) {
      const canvas = previewCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || canvas.width === 0 || canvas.height === 0) {
        return;
      }

      // 重新绘制波形和进度线
      drawStaticWaveform(canvas, previewPeaksRef.current);

      // 计算播放进度位置（基于 playbackProgress state）
      const x = (playbackProgress / 100) * canvas.width;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  }, [recorder.phase, playbackProgress]);

  const handleClose = () => {
    if (recorder.phase === "idle") {
      onClose();
    } else {
      setShowConfirmClose(true);
    }
  };

  const handleConfirmClose = () => {
    recorder.destroy();
    revokeObjectUrl();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    onClose();
  };

  const handleRetake = () => {
    recorder.reset();
    setShowConfirmRetake(false);
    setIsPlaying(false);
    setPlaybackProgress(0);
    setRecordingName("录音音频");
    revokeObjectUrl();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    previewPeaksRef.current = null;
  };

  const handleAddToTimeline = () => {
    if (recorder.result && onAddToTimeline) {
      onAddToTimeline(recorder.result, recordingName.trim() || "录音音频");
      onClose();
    }
  };

  const handleAddToLibrary = () => {
    if (recorder.result && onAddToLibrary) {
      onAddToLibrary(recorder.result, recordingName.trim() || "录音音频");
      onClose();
    }
  };

  const phase = recorder.phase;
  const showCloseButton = phase !== "countdown";

  return (
    <div className="audio-record-overlay">
      {/* 关闭按钮 */}
      {showCloseButton && (
        <button
          className="audio-record-overlay__close"
          onClick={handleClose}
          aria-label="关闭"
        >
          <X size={20} />
        </button>
      )}

      {/* idle 阶段 */}
      {phase === "idle" && (
        <>
          <div className="audio-record-overlay__waveform-container">
            <div
              ref={waveformContainerRef}
              className="audio-record-overlay__waveform"
            />
            {micPreviewError && (
              <div className="audio-record-overlay__waveform-error">
                {micPreviewError}
              </div>
            )}
          </div>
          <div className="audio-record-overlay__idle-controls">
            <button
              className="audio-record-overlay__record-btn"
              onClick={recorder.startCountdown}
              aria-label="开始录制"
            >
              <div className="audio-record-overlay__record-btn-ring" />
              <div className="audio-record-overlay__record-btn-inner" />
            </button>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  className="audio-record-overlay__settings-btn"
                  aria-label="设置"
                >
                  <Settings size={20} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="audio-record-overlay__popover"
                  side="top"
                  sideOffset={8}
                >
                  <div className="audio-record-overlay__popover-title">
                    麦克风
                  </div>
                  <div className="audio-record-overlay__device-list">
                    {mic.devices.map((device) => (
                      <button
                        key={device.deviceId}
                        className={`audio-record-overlay__device-item ${
                          device.deviceId === mic.selectedId
                            ? "audio-record-overlay__device-item--selected"
                            : ""
                        }`}
                        onClick={() => mic.setSelectedId(device.deviceId)}
                      >
                        {device.deviceId === mic.selectedId && (
                          <Check size={16} />
                        )}
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
          className="audio-record-overlay__countdown"
          onClick={recorder.cancelCountdown}
        >
          <div className="audio-record-overlay__countdown-number">
            {recorder.countdownRemaining}
          </div>
          <div className="audio-record-overlay__countdown-hint">
            单击任意位置以取消
          </div>
        </div>
      )}

      {/* recording / paused 阶段 */}
      {(phase === "recording" || phase === "paused") && (
        <>
          <div className="audio-record-overlay__recording-header">
            <div
              className={`audio-record-overlay__recording-indicator ${
                phase === "paused"
                  ? "audio-record-overlay__recording-indicator--paused"
                  : ""
              }`}
            />
            <span className="audio-record-overlay__recording-time">
              {formatDuration(recorder.elapsedMs)} /{" "}
              {formatDuration(MAX_RECORDING_DURATION_MS)}
            </span>
          </div>
          <div className="audio-record-overlay__waveform-container">
            <div
              ref={waveformContainerRef}
              className="audio-record-overlay__waveform"
            />
          </div>
          <div className="audio-record-overlay__controls">
            <button
              className="audio-record-overlay__control-btn"
              onClick={() => {
                recorder.reset();
                recorder.startCountdown();
              }}
              aria-label="重新录制"
            >
              <RefreshCcw size={20} />
            </button>
            <button
              className="audio-record-overlay__control-btn audio-record-overlay__control-btn--stop"
              onClick={recorder.stop}
              aria-label="停止录制"
            >
              <Square size={20} fill="currentColor" />
            </button>
            {phase === "recording" ? (
              <button
                className="audio-record-overlay__control-btn"
                onClick={recorder.pause}
                aria-label="暂停录制"
              >
                <Pause size={20} />
              </button>
            ) : (
              <button
                className="audio-record-overlay__control-btn"
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
          <div className="audio-record-overlay__preview-header">
            <input
              type="text"
              className="audio-record-overlay__preview-title"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              placeholder="录制名称"
              aria-label="录制名称"
            />
            <div className="audio-record-overlay__preview-time">
              {audioRef.current && audioRef.current.duration
                ? formatDuration(audioRef.current.currentTime * 1000)
                : "00:00"}{" "}
              / {formatDuration(recorder.result.durationMs)}
            </div>
          </div>
          <div className="audio-record-overlay__preview-waveform-container">
            <canvas
              ref={previewCanvasRef}
              className="audio-record-overlay__preview-waveform"
            />
          </div>
          <div className="audio-record-overlay__preview-controls">
            <button
              className="audio-record-overlay__action-btn audio-record-overlay__action-btn--retake"
              onClick={() => setShowConfirmRetake(true)}
              aria-label="重新录制"
            >
              <RefreshCcw size={20} />
            </button>
            <button
              className="audio-record-overlay__preview-play-btn"
              onClick={handlePlayPause}
              aria-label={isPlaying ? "暂停" : "播放"}
            >
              {isPlaying ? (
                <Pause size={24} />
              ) : (
                <Play size={24} fill="currentColor" />
              )}
            </button>
            <div className="audio-record-overlay__action-group">
              <button
                className="audio-record-overlay__action-btn audio-record-overlay__action-btn--secondary"
                onClick={handleAddToLibrary}
                aria-label="添加到媒体库"
              >
                <Upload size={16} />
                <span>添加到媒体库</span>
              </button>
              <button
                className="audio-record-overlay__action-btn audio-record-overlay__action-btn--primary"
                onClick={handleAddToTimeline}
                aria-label="添加到时间轴"
              >
                <Plus size={16} />
                <span>添加到时间轴</span>
              </button>
            </div>
          </div>
          <audio ref={audioRef} style={{ display: "none" }} />
        </>
      )}

      {/* 确认重拍对话框 */}
      <Dialog.Root open={showConfirmRetake} onOpenChange={setShowConfirmRetake}>
        <Dialog.Portal>
          <Dialog.Overlay className="audio-record-overlay__dialog-overlay" />
          <Dialog.Content className="audio-record-overlay__dialog">
            <Dialog.Title className="audio-record-overlay__dialog-title">
              重新录制?
            </Dialog.Title>
            <Dialog.Description className="audio-record-overlay__dialog-description">
              如果选择重录，当前录音将被删除。
            </Dialog.Description>
            <div className="audio-record-overlay__dialog-actions">
              <Dialog.Close asChild>
                <button className="audio-record-overlay__dialog-btn audio-record-overlay__dialog-btn--cancel">
                  停留此处
                </button>
              </Dialog.Close>
              <button
                className="audio-record-overlay__dialog-btn audio-record-overlay__dialog-btn--confirm"
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
          <Dialog.Overlay className="audio-record-overlay__dialog-overlay" />
          <Dialog.Content className="audio-record-overlay__dialog">
            <Dialog.Title className="audio-record-overlay__dialog-title">
              放弃录制?
            </Dialog.Title>
            <Dialog.Description className="audio-record-overlay__dialog-description">
              如果放弃，当前录音将丢失。
            </Dialog.Description>
            <div className="audio-record-overlay__dialog-actions">
              <Dialog.Close asChild>
                <button className="audio-record-overlay__dialog-btn audio-record-overlay__dialog-btn--cancel">
                  继续录制
                </button>
              </Dialog.Close>
              <button
                className="audio-record-overlay__dialog-btn audio-record-overlay__dialog-btn--danger"
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
