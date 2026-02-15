export type RecordingKind = 'audio' | 'camera';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface BaseRecordingOptions {
  /**
   * 媒体编码格式，传递给 MediaRecorder。
   * 例如：audio/webm;codecs=opus、video/webm;codecs=vp9 等。
   * 为空则由浏览器自行选择。
   */
  mimeType?: string;
}

export interface AudioRecordingOptions extends BaseRecordingOptions {
  kind: 'audio';
  /** 使用已有 stream 时跳过 getUserMedia，可避免重复权限弹窗 */
  stream?: MediaStream;
  constraints?: MediaTrackConstraints;
}

export interface CameraRecordingOptions extends BaseRecordingOptions {
  kind: 'camera';
  /**
   * 是否同时采集麦克风。
   */
  withAudio?: boolean;
  videoConstraints?: MediaTrackConstraints;
  audioConstraints?: MediaTrackConstraints;
}

export type RecordingOptions = AudioRecordingOptions | CameraRecordingOptions;

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
}

function ensureBrowserEnv(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('@swiftav/record 仅支持在浏览器环境下使用');
  }
}

function createMediaRecorder(
  stream: MediaStream,
  options: BaseRecordingOptions,
): MediaRecorder {
  const { mimeType } = options;
  if (mimeType && MediaRecorder.isTypeSupported(mimeType)) {
    return new MediaRecorder(stream, { mimeType });
  }
  return new MediaRecorder(stream);
}

async function startRecordingInternal(
  options: RecordingOptions,
): Promise<RecordingHandle> {
  ensureBrowserEnv();

  let stream: MediaStream;
  if (options.kind === 'audio') {
    const audioOpts = options as AudioRecordingOptions;
    if (audioOpts.stream) {
      stream = audioOpts.stream;
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: options.constraints ?? true,
        video: false,
      });
    }
  } else {
    stream = await navigator.mediaDevices.getUserMedia({
      video: options.videoConstraints ?? true,
      audio: options.withAudio ? options.audioConstraints ?? true : false,
    });
  }

  const recorder = createMediaRecorder(stream, options);
  const kind: RecordingKind = options.kind;

  let state: RecordingState = 'idle';
  const chunks: BlobPart[] = [];
  let recordingStartTime = 0;
  const startTimeFallback = performance.now();

  const stopped = new Promise<RecordingResult>((resolve, reject) => {
    recorder.onstart = () => {
      recordingStartTime = performance.now();
    };

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      reject(event.error ?? new Error('MediaRecorder error'));
    };

    recorder.onstop = () => {
      const start = recordingStartTime > 0 ? recordingStartTime : startTimeFallback;
      const durationMs = performance.now() - start;
      const mimeType = recorder.mimeType || options.mimeType || '';
      const blob = new Blob(chunks, { type: mimeType });

      // 停止所有轨道，释放设备
      stream.getTracks().forEach((track) => track.stop());

      resolve({
        kind,
        blob,
        mimeType,
        durationMs,
      });
    };
  });

  recorder.start();
  state = 'recording';

  return {
    kind,
    get state() {
      return state;
    },
    stream,
    pause() {
      if (recorder.state === 'recording') {
        recorder.pause();
        state = 'paused';
      }
    },
    resume() {
      if (recorder.state === 'paused') {
        recorder.resume();
        state = 'recording';
      }
    },
    stop() {
      if (recorder.state !== 'inactive') {
        recorder.stop();
        state = 'stopped';
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
  options: Omit<AudioRecordingOptions, 'kind'> = {},
): Promise<RecordingHandle> {
  return startRecordingInternal({
    ...options,
    kind: 'audio',
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
  options: Omit<CameraRecordingOptions, 'kind'> = {},
): Promise<RecordingHandle> {
  return startRecordingInternal({
    ...options,
    kind: 'camera',
  });
}
