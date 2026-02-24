export type RecordingKind = "audio" | "camera" | "screen";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export interface BaseRecordingOptions {
  /**
   * 媒体编码格式，传递给 MediaRecorder。
   * 例如：audio/webm;codecs=opus、video/webm;codecs=vp9 等。
   * 为空则由浏览器自行选择。
   */
  mimeType?: string;
  /** 音频编码码率（bps），默认 128kbps */
  audioBitsPerSecond?: number;
}

export interface AudioRecordingOptions extends BaseRecordingOptions {
  kind: "audio";
  /** 使用已有 stream 时跳过 getUserMedia，可避免重复权限弹窗 */
  stream?: MediaStream;
  constraints?: MediaTrackConstraints;
}

export interface CameraRecordingOptions extends BaseRecordingOptions {
  kind: "camera";
  /**
   * 是否同时采集麦克风。
   */
  withAudio?: boolean;
  videoConstraints?: MediaTrackConstraints;
  audioConstraints?: MediaTrackConstraints;
  /** 视频编码码率（bps），值越高画质越清晰。默认 8Mbps */
  videoBitsPerSecond?: number;
}

export interface ScreenRecordingOptions extends BaseRecordingOptions {
  kind: "screen";
  /** 是否同时采集麦克风音频 */
  withAudio?: boolean;
  audioConstraints?: MediaTrackConstraints;
  /** 传递给 getDisplayMedia 的视频约束 */
  displayMediaOptions?: DisplayMediaStreamOptions;
  /** 视频编码码率（bps），值越高画质越清晰。默认 8Mbps */
  videoBitsPerSecond?: number;
}

export type RecordingOptions =
  | AudioRecordingOptions
  | CameraRecordingOptions
  | ScreenRecordingOptions;

export interface RecordingResult {
  kind: RecordingKind;
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface RecordingHandle {
  kind: RecordingKind;
  state: RecordingState;
  stream: MediaStream;
  /**
   * 暂停录制（依赖 MediaRecorder 支持）。
   */
  pause(): void;
  /**
   * 恢复录制。
   */
  resume(): void;
  /**
   * 停止录制并返回结果。
   */
  stop(): Promise<RecordingResult>;
  /**
   * 注册流结束回调（如用户通过浏览器 UI 停止屏幕共享）。
   * 仅对 screen 类型有意义，其他类型不会触发。
   */
  onStreamEnded?: (callback: () => void) => void;
}

function ensureBrowserEnv(): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new Error("@vitecut/record 仅支持在浏览器环境下使用");
  }
}

/** 默认视频码率 8Mbps，保证录制画质清晰 */
const DEFAULT_VIDEO_BPS = 8_000_000;
/** 默认音频码率 128kbps */
const DEFAULT_AUDIO_BPS = 128_000;

function createMediaRecorder(
  stream: MediaStream,
  options: RecordingOptions,
): MediaRecorder {
  const { mimeType } = options;
  const hasVideo = stream.getVideoTracks().length > 0;

  const recorderOptions: MediaRecorderOptions = {};

  if (mimeType && MediaRecorder.isTypeSupported(mimeType)) {
    recorderOptions.mimeType = mimeType;
  }

  if (hasVideo && (options.kind === "camera" || options.kind === "screen")) {
    recorderOptions.videoBitsPerSecond =
      options.videoBitsPerSecond ?? DEFAULT_VIDEO_BPS;
  }

  if (stream.getAudioTracks().length > 0) {
    recorderOptions.audioBitsPerSecond =
      options.audioBitsPerSecond ?? DEFAULT_AUDIO_BPS;
  }

  return new MediaRecorder(stream, recorderOptions);
}

async function startRecordingInternal(
  options: RecordingOptions,
): Promise<RecordingHandle> {
  ensureBrowserEnv();

  let stream: MediaStream;
  let streamEndedCallback: (() => void) | null = null;

  if (options.kind === "audio") {
    const audioOpts = options as AudioRecordingOptions;
    if (audioOpts.stream) {
      stream = audioOpts.stream;
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: options.constraints ?? true,
        video: false,
      });
    }
  } else if (options.kind === "camera") {
    stream = await navigator.mediaDevices.getUserMedia({
      video: options.videoConstraints ?? true,
      audio: options.withAudio ? (options.audioConstraints ?? true) : false,
    });
  } else {
    // screen: 通过 getDisplayMedia 获取屏幕流
    const screenOpts = options as ScreenRecordingOptions;
    const displayStream = await navigator.mediaDevices.getDisplayMedia(
      screenOpts.displayMediaOptions ?? { video: true, audio: true },
    );

    if (screenOpts.withAudio) {
      // 额外获取麦克风流并合并到屏幕流
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: screenOpts.audioConstraints ?? true,
          video: false,
        });
        for (const track of micStream.getAudioTracks()) {
          displayStream.addTrack(track);
        }
      } catch {
        // 麦克风不可用时仍继续屏幕录制
      }
    }

    stream = displayStream;
  }

  const recorder = createMediaRecorder(stream, options);
  const kind: RecordingKind = options.kind;

  let state: RecordingState = "idle";
  const chunks: BlobPart[] = [];

  // 累计有效录制时长（扣除暂停时间）
  let accumulatedMs = 0;
  let segmentStart = 0;

  const stopped = new Promise<RecordingResult>((resolve, reject) => {
    recorder.onstart = () => {
      segmentStart = performance.now();
    };

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      reject(event.error ?? new Error("MediaRecorder error"));
    };

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || options.mimeType || "";
      const blob = new Blob(chunks, { type: mimeType });

      resolve({
        kind,
        blob,
        mimeType,
        durationMs: accumulatedMs,
      });
    };
  });

  // 防止 onerror reject 时产生 unhandled rejection
  stopped.catch(() => {});

  recorder.start();
  state = "recording";

  // 屏幕录制：监听视频轨道结束（用户通过浏览器 UI 停止共享）
  if (options.kind === "screen") {
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener("ended", () => {
        if (streamEndedCallback) streamEndedCallback();
      });
    }
  }

  return {
    kind,
    get state() {
      return state;
    },
    stream,
    onStreamEnded:
      options.kind === "screen"
        ? (cb: () => void) => {
            streamEndedCallback = cb;
          }
        : undefined,
    pause() {
      if (recorder.state === "recording") {
        accumulatedMs += performance.now() - segmentStart;
        recorder.pause();
        state = "paused";
      }
    },
    resume() {
      if (recorder.state === "paused") {
        recorder.resume();
        segmentStart = performance.now();
        state = "recording";
      }
    },
    stop() {
      if (recorder.state !== "inactive") {
        // 在触发 onstop 之前结算最后一段有效录制时间
        if (state === "recording") {
          accumulatedMs += performance.now() - segmentStart;
        }
        state = "stopped";
        recorder.stop();
      }
      return stopped;
    },
  };
}

/**
 * 开始麦克风音频录制。
 *
 * 示例：
 * ```ts
 * const handle = await startAudioRecording();
 * // ... 用户点击停止时
 * const result = await handle.stop();
 * const url = URL.createObjectURL(result.blob);
 * ```
 */
export async function startAudioRecording(
  options: Omit<AudioRecordingOptions, "kind"> = {},
): Promise<RecordingHandle> {
  return startRecordingInternal({
    ...options,
    kind: "audio",
  });
}

/**
 * 开始摄像头录制（可选带麦克风）。
 *
 * 示例：
 * ```ts
 * const handle = await startCameraRecording({ withAudio: true });
 * const previewVideo = document.querySelector('video');
 * previewVideo.srcObject = handle.stream;
 * // ... 停止
 * const result = await handle.stop();
 * ```
 */
export async function startCameraRecording(
  options: Omit<CameraRecordingOptions, "kind"> = {},
): Promise<RecordingHandle> {
  return startRecordingInternal({
    ...options,
    kind: "camera",
  });
}

/**
 * 开始屏幕录制（可选带麦克风）。
 *
 * 使用 getDisplayMedia 采集屏幕，可额外获取麦克风音频合并录制。
 * 当用户通过浏览器 UI 停止共享时，可通过 handle.onStreamEnded 监听。
 *
 * 示例：
 * ```ts
 * const handle = await startScreenRecording({ withAudio: true });
 * handle.onStreamEnded?.(() => handle.stop());
 * const previewVideo = document.querySelector('video');
 * previewVideo.srcObject = handle.stream;
 * // ... 停止
 * const result = await handle.stop();
 * ```
 */
export async function startScreenRecording(
  options: Omit<ScreenRecordingOptions, "kind"> = {},
): Promise<RecordingHandle> {
  return startRecordingInternal({
    ...options,
    kind: "screen",
  });
}
