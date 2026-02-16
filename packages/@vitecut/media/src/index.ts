import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  UrlSource,
} from "mediabunny";

/**
 * 媒体基础信息（解码侧）- 视频轨道。
 */
export interface MediaTrackVideoInfo {
  displayWidth: number;
  displayHeight: number;
  rotation: number;
  /**
   * 视频编码格式，例如 H.264 (avc)、AV1 (av1) 等。
   * 具体字符串由 mediabunny 提供，这里用 string|null 兼容。
   */
  codec?: string | null;
}

/**
 * 媒体基础信息（解码侧）- 音频轨道。
 */
export interface MediaTrackAudioInfo {
  sampleRate: number;
  numberOfChannels: number;
  /**
   * 音频编码格式，例如 AAC / Opus 等。
   */
  codec?: string | null;
}

/**
 * 媒体整体信息（时长 + 主视频/音频轨道）。
 */
export interface MediaInfo {
  duration: number;
  video?: MediaTrackVideoInfo;
  audio?: MediaTrackAudioInfo;
}

/**
 * 统一的媒体源抽象，方便上层传入 URL 或本地文件。
 */
export type MediaSource =
  | { type: "url"; url: string }
  | { type: "blob"; blob: Blob };

/**
 * 从 URL 创建 mediabunny 的 Input 实例。
 *
 * 仅封装 source/formats，其他行为保持 mediabunny 默认。
 */
export function createInputFromUrl(url: string): Input {
  return new Input({
    source: new UrlSource(url),
    formats: ALL_FORMATS,
  });
}

/**
 * 从 Blob/File 创建 mediabunny 的 Input 实例。
 */
export function createInputFromBlob(blob: Blob): Input {
  return new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });
}

/**
 * 从统一的 MediaSource 创建 Input。
 */
export function createInputFromSource(source: MediaSource): Input {
  if (source.type === "url") {
    return createInputFromUrl(source.url);
  }
  return createInputFromBlob(source.blob);
}

/**
 * 解析媒体的基础信息（时长 / 主视频轨 / 主音频轨参数）。
 *
 * 该方法只做轻量级解析，不返回全部帧数据。
 */
export async function probeMedia(source: MediaSource): Promise<MediaInfo> {
  const input = createInputFromSource(source);

  const duration = await input.computeDuration();

  const [videoTrack, audioTrack] = await Promise.all([
    input.getPrimaryVideoTrack().catch(() => null),
    input.getPrimaryAudioTrack().catch(() => null),
  ]);

  const video: MediaTrackVideoInfo | undefined = videoTrack
    ? {
        displayWidth: videoTrack.displayWidth,
        displayHeight: videoTrack.displayHeight,
        rotation: videoTrack.rotation,
        codec: videoTrack.codec,
      }
    : undefined;

  const audio: MediaTrackAudioInfo | undefined = audioTrack
    ? {
        sampleRate: audioTrack.sampleRate,
        numberOfChannels: audioTrack.numberOfChannels,
        codec: audioTrack.codec,
      }
    : undefined;

  return {
    duration,
    video,
    audio,
  };
}

/**
 * Canvas 视频导出配置。
 *
 * 该工具只负责帮你创建 Output + CanvasSource，不直接驱动渲染帧。
 * 上层可以结合 @vitecut/canvas 在导出专用 canvas 上绘制每一帧，
 * mediabunny 会通过 CanvasSource 采集像素并编码。
 */
export interface CanvasVideoOutputOptions {
  /**
   * 作为视频源的 canvas。通常是一个离屏 canvas。
   */
  canvas: HTMLCanvasElement;
  /**
   * 目标格式，目前简单支持 mp4，后续可扩展 webm 等。
   */
  format?: "mp4";
  /**
   * 视频编码器名称，传递给 Mediabunny 的 CanvasSource。
   * 例如 'av1'。
   */
  codec?: "avc" | "hevc" | "vp9" | "av1" | "vp8";
  /**
   * 码率配置，透传给 Mediabunny。
   */
  bitrate?: number;
}

export interface CanvasVideoOutput {
  /**
   * Mediabunny 的 Output 实例，由调用方在适当时机执行 finalize。
   */
  output: Output;
  /**
   * 绑定到 canvas 的 CanvasSource。
   */
  videoSource: CanvasSource;
}

/**
 * 创建基于 canvas 的视频输出对象（编码侧）。
 *
 * 用法示例：
 *
 * ```ts
 * const canvas = document.createElement('canvas');
 * const { output, videoSource } = await createCanvasVideoOutput({ canvas, codec: 'av1' });
 *
 * await output.start();
 * // 在循环中使用 @vitecut/canvas 在 canvas 上绘制每一帧
 * await output.finalize();
 * const { buffer } = output.target; // 导出的视频数据
 * ```
 */
export async function createCanvasVideoOutput(
  options: CanvasVideoOutputOptions,
): Promise<CanvasVideoOutput> {
  const { canvas, format = "mp4", codec, bitrate } = options;

  const output = new Output({
    // 目前仅简单支持 Mp4OutputFormat，后续可扩展 WebMOutputFormat 等
    format: new Mp4OutputFormat(),
    // 使用 BufferTarget 作为输出目标，调用方可在 finalize 之后从 output.target 读取数据
    target: new BufferTarget(),
  });

  // CanvasSource 需要显式的 codec 与 bitrate，这里提供一份合理的默认值。
  const resolvedCodec: NonNullable<CanvasVideoOutputOptions["codec"]> =
    codec ?? "av1";
  const resolvedBitrate = bitrate ?? 2_000_000; // 约 2 Mbps，后续可由调用方传入覆盖

  const videoSource = new CanvasSource(canvas, {
    codec: resolvedCodec,
    bitrate: resolvedBitrate,
  });

  output.addVideoTrack(videoSource);

  return { output, videoSource };
}
