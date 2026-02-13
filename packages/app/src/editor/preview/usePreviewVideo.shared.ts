import type { RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Clip } from "@swiftav/project";
import type {
  AudioBufferSink,
  CanvasSink,
  Input,
  WrappedAudioBuffer,
  WrappedCanvas,
} from "mediabunny";

export type SinkEntry = {
  input: Input;
  sink: CanvasSink;
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
