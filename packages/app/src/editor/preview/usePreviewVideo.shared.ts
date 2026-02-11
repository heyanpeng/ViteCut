import type { RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Clip, Project } from "@swiftav/project";
import type { CanvasSink, Input, WrappedCanvas } from "mediabunny";

export type SinkEntry = {
  input: Input;
  sink: CanvasSink;
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
  clipIteratorsRef: RefObject<Map<string, AsyncGenerator<WrappedCanvas, void, unknown>>>;
  clipNextFrameRef: RefObject<Map<string, WrappedCanvas | null>>;

  projectRef: RefObject<Project | null>;
  isPlayingRef: RefObject<boolean>;
  playbackTimeAtStartRef: RefObject<number>;
  wallStartRef: RefObject<number>;
  durationRef: RefObject<number>;
  playbackClockStartedRef: RefObject<boolean>;
  /** 与 examples/media-player 一致：用 AudioContext 时钟驱动播放，避免主线程卡顿导致时快时慢 */
  audioContextRef: RefObject<AudioContext | null>;
  audioContextStartTimeRef: RefObject<number>;
  audioClockReadyRef: RefObject<boolean>;
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
): HTMLCanvasElement | null => {
  const { width: stageW, height: stageH } = getStageSize(editor);
  let canvas = clipCanvasesRef.current.get(clip.id);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = stageW;
    canvas.height = stageH;
    clipCanvasesRef.current.set(clip.id, canvas);
    const x = clip.transform?.x ?? 0;
    const y = clip.transform?.y ?? 0;
    const scaleX = clip.transform?.scaleX ?? 1;
    const scaleY = clip.transform?.scaleY ?? 1;
    const w = stageW * scaleX;
    const h = stageH * scaleY;
    editor.addVideo({
      id: clip.id,
      video: canvas,
      x,
      y,
      width: w,
      height: h,
    });
    syncedVideoClipIdsRef.current.add(clip.id);
  }
  return canvas;
};

