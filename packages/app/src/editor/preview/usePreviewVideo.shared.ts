import type { RefObject } from "react";
import type { CanvasEditor } from "@vitecut/canvas";
import type { Clip } from "@vitecut/project";
import type {
  AudioBufferSink,
  CanvasSink,
  Input,
  WrappedAudioBuffer,
  WrappedCanvas,
} from "mediabunny";

export type SinkEntry = {
  input: Input;
  /** 视频 asset 的 CanvasSink；纯音频 asset 为 null */
  sink: CanvasSink | null;
  /** 有音轨时存在，用于 Web Audio 排程播放（与 media-player 一致） */
  audioSink: AudioBufferSink | null;
};

/**
 * usePreviewVideo 的运行时 ref 集合。
 *
 * 说明：
 * - 视频预览需要跨多个 useEffect 共享大量可变状态（sinks、canvas、iterator、播放时钟等）。
 * - 这些 ref 是“实现细节”，避免散落在多个文件里造成耦合；统一收口为一个 runtime 便于拆分模块。
 */
export type VideoPreviewRuntime = {
  sinksByAssetRef: RefObject<Map<string, SinkEntry>>;
  clipCanvasesRef: RefObject<Map<string, HTMLCanvasElement>>;
  syncedVideoClipIdsRef: RefObject<Set<string>>;

  videoFrameRequestTimeRef: RefObject<number>;
  clipIteratorsRef: RefObject<
    Map<string, AsyncGenerator<WrappedCanvas, void, unknown>>
  >;
  clipNextFrameRef: RefObject<Map<string, WrappedCanvas | null>>;

  /** 暂停时预创建的 iterator + 首帧/第二帧，播放时直接使用以减少延迟 */
  playbackPrefetchRef: RefObject<
    Map<
      string,
      {
        sourceTime: number;
        iterator: AsyncGenerator<WrappedCanvas, void, unknown>;
        firstFrame: WrappedCanvas | null;
        nextFrame: WrappedCanvas | null;
      }
    >
  >;

  playbackTimeAtStartRef: RefObject<number>;
  wallStartRef: RefObject<number>;
  playbackClockStartedRef: RefObject<boolean>;
  /** 与 examples/media-player 一致：用 AudioContext 时钟驱动播放 */
  audioContextRef: RefObject<AudioContext | null>;
  audioContextStartTimeRef: RefObject<number>;
  audioClockReadyRef: RefObject<boolean>;
  /** 已排程未播完的 BufferSource，pause 时统一 stop */
  queuedAudioNodesRef: RefObject<Set<AudioBufferSourceNode>>;
  /** 各 clip 的音频迭代器，pause 时 return 掉 */
  audioIteratorsByClipIdRef: RefObject<
    Map<string, AsyncGenerator<WrappedAudioBuffer, void, unknown>>
  >;
  /** 各 clip 复用的单个 GainNode，用于播放中响应 track.muted 变化（一 clip 一节点，不随 buffer 创建） */
  gainNodeByClipIdRef: RefObject<Map<string, GainNode>>;
};

export type StageSize = {
  width: number;
  height: number;
};

export const getStageSize = (editor: CanvasEditor): StageSize => {
  const size = editor.getStage().size();
  return {
    width: Math.max(1, Math.round(size.width)),
    height: Math.max(1, Math.round(size.height)),
  };
};

/**
 * 确保该 clip 在舞台上已有对应 video 节点与 canvas；若无则创建并 addVideo。
 * 供静态同步与播放循环共用，避免“移动 clip 后播放时”因静态同步曾移除节点而导致播放不显示。
 */
export const ensureClipCanvasOnStage = (
  editor: CanvasEditor,
  clip: Clip,
  clipCanvasesRef: RefObject<Map<string, HTMLCanvasElement>>,
  syncedVideoClipIdsRef: RefObject<Set<string>>,
  projectSize?: { width: number; height: number },
): HTMLCanvasElement | null => {
  const { width: stageW, height: stageH } = getStageSize(editor);
  // 离屏 canvas 使用工程逻辑分辨率，保证高清绘制；Konva 节点使用舞台尺寸控制显示
  const canvasW = projectSize?.width ?? stageW;
  const canvasH = projectSize?.height ?? stageH;
  const x = clip.transform?.x ?? 0;
  const y = clip.transform?.y ?? 0;
  const scaleX = clip.transform?.scaleX ?? 1;
  const scaleY = clip.transform?.scaleY ?? 1;
  const rotation = clip.transform?.rotation ?? 0;
  const opacity = clip.transform?.opacity ?? 1;

  // clip 存 top-left，节点用 center + offset 使旋转以中心为原点、位置不变
  const centerX = x + (stageW * scaleX) / 2;
  const centerY = y + (stageH * scaleY) / 2;

  let canvas = clipCanvasesRef.current.get(clip.id);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    clipCanvasesRef.current.set(clip.id, canvas);
    editor.addVideo({
      id: clip.id,
      video: canvas,
      x: centerX,
      y: centerY,
      width: stageW,
      height: stageH,
      offsetX: stageW / 2,
      offsetY: stageH / 2,
      scaleX,
      scaleY,
      rotation,
      opacity,
    });
    syncedVideoClipIdsRef.current.add(clip.id);
  } else {
    if (canvas.width !== canvasW || canvas.height !== canvasH) {
      canvas.width = canvasW;
      canvas.height = canvasH;
    }
    editor.updateVideo(clip.id, {
      x: centerX,
      y: centerY,
      width: stageW,
      height: stageH,
      offsetX: stageW / 2,
      offsetY: stageH / 2,
      scaleX,
      scaleY,
      rotation,
      opacity,
    });
  }
  return canvas;
};

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  if (num < min) return min;
  if (num > max) return max;
  return num;
};

/** 从 clip.params 里解析视频画面调整参数，并转换为 Canvas 2D filter 字符串 */
export const getClipCanvasFilter = (clip: Clip): string => {
  const params = (clip.params ?? {}) as Record<string, unknown>;

  const brightnessPercent = clampNumber(
    params.brightness ?? 100,
    0,
    200,
    100,
  );
  const contrastPercent = clampNumber(params.contrast ?? 100, 0, 200, 100);
  const saturationPercent = clampNumber(
    params.saturation ?? 100,
    0,
    200,
    100,
  );
  const hueRotateDeg = clampNumber(params.hueRotate ?? 0, 0, 360, 0);
  const blurPx = clampNumber(params.blur ?? 0, 0, 30, 0);

  const brightnessFactor = brightnessPercent / 100;
  const contrastFactor = contrastPercent / 100;
  const saturationFactor = saturationPercent / 100;

  const parts: string[] = [];
  // 默认值都为“无影响”时直接返回 "none"
  if (
    brightnessFactor === 1 &&
    contrastFactor === 1 &&
    saturationFactor === 1 &&
    hueRotateDeg === 0 &&
    blurPx === 0
  ) {
    return "none";
  }

  parts.push(`brightness(${brightnessFactor})`);
  parts.push(`contrast(${contrastFactor})`);
  parts.push(`saturate(${saturationFactor})`);
  if (hueRotateDeg !== 0) {
    parts.push(`hue-rotate(${hueRotateDeg}deg)`);
  }
  if (blurPx > 0) {
    parts.push(`blur(${blurPx}px)`);
  }

  return parts.join(" ");
};

/** 将静态图片绘制到目标 canvas，并应用 clip 对应的画面调整滤镜（视频/图片通用） */
export const drawImageWithFiltersToCanvas = (
  clip: Clip,
  targetCanvas: HTMLCanvasElement,
  sourceImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  width: number,
  height: number,
): void => {
  if (targetCanvas.width !== width || targetCanvas.height !== height) {
    targetCanvas.width = width;
    targetCanvas.height = height;
  }
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  const filter = getClipCanvasFilter(clip);
  ctx.filter = filter && filter !== "none" ? filter : "none";
  ctx.drawImage(sourceImage, 0, 0, width, height);
  ctx.restore();
};

/** 在目标 canvas 上绘制一帧视频画面，并应用 clip 对应的画面调整滤镜 */
export const drawVideoFrameToCanvasWithFilters = (
  clip: Clip,
  targetCanvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
): void => {
  drawImageWithFiltersToCanvas(
    clip,
    targetCanvas,
    sourceCanvas,
    targetCanvas.width,
    targetCanvas.height,
  );
};
