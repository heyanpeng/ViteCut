import { createCanvasVideoOutput } from "@vitecut/media";

export interface RenderLoopOptions {
  /**
   * 用于采集像素的 canvas（通常是一个离屏 canvas）。
   * 上层可以在回调中使用 @vitecut/canvas 在该 canvas 上绘制每一帧。
   */
  canvas: HTMLCanvasElement;
  /**
   * 总时长（秒）
   */
  duration: number;
  /**
   * 目标帧率
   */
  fps: number;
  /**
   * 每一帧渲染回调。
   * 调用方在该函数内根据 time 使用 @vitecut/canvas / @vitecut/project 等完成画面绘制。
   */
  renderFrame: (time: number) => Promise<void> | void;
  /**
   * 进度回调，0-1。
   */
  onProgress?: (progress: number) => void;
}

/**
 * 通用的离线渲染循环：
 *
 * - 使用 @vitecut/media 创建基于 canvas 的视频输出
 * - 按给定 fps 迭代时间
 * - 对每一帧调用 renderFrame，让上层去拼 timeline + canvas + project
 * - 最后调用 finalize 完成编码
 *
 * 该模块不直接依赖 @vitecut/canvas / @vitecut/project，以保持包之间的职责独立。
 */
export async function renderVideoWithCanvasLoop(options: RenderLoopOptions) {
  const { canvas, duration, fps, renderFrame, onProgress } = options;

  const { output } = await createCanvasVideoOutput({
    canvas,
    format: "mp4",
    codec: "av1",
  });

  await output.start();

  const totalFrames = Math.max(1, Math.round(duration * fps));

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;

    await renderFrame(t);

    if (onProgress) {
      onProgress((i + 1) / totalFrames);
    }
  }

  await output.finalize();

  return output;
}
