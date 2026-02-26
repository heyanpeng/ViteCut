import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

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
   * 视频编码器名称，传递给 mediabunny 的 CanvasSource。
   * 例如 'av1'。
   */
  codec?: "avc" | "hevc" | "vp9" | "av1" | "vp8";
  /**
   * 码率配置（比特率），透传给 mediabunny。
   */
  bitrate?: number;
}

export interface CanvasVideoOutput {
  /**
   * mediabunny 的 Output 实例，由调用方在适当时机执行 finalize。
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
  options: CanvasVideoOutputOptions
): Promise<CanvasVideoOutput> {
  const { canvas, codec, bitrate } = options;

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
