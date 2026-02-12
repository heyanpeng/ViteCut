import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { WrappedCanvas, CanvasSink, Input } from "mediabunny";
import { useProjectStore } from "@/stores";
import { usePreviewVideoSinks } from "./usePreviewVideo.sinks";
import { usePreviewVideoStaticFrameSync } from "./usePreviewVideo.staticSync";
import {
  usePreviewVideoPlaybackInit,
  usePreviewVideoPlaybackLoop,
} from "./usePreviewVideo.playback";
import type { VideoPreviewRuntime } from "./usePreviewVideo.shared";

/**
 * usePreviewVideo
 *
 * 这个 hook 曾经非常长（sinks 管理 + 静帧同步 + 播放循环 混在一起）。
 * 现在按职责拆成 3 个模块，`usePreviewVideo.ts` 只负责“组装”：
 * - `usePreviewVideoSinks`：增量维护 sinks（为新增 asset 建 sink，清理无效 sink/节点）
 * - `usePreviewVideoStaticFrameSync`：暂停/seek 时按 currentTime 拉取单帧并渲染
 * - `usePreviewVideoPlaybackInit` + `usePreviewVideoPlaybackLoop`：播放时初始化迭代器并 rAF 渲染
 */
export function usePreviewVideo(
  editorRef: RefObject<CanvasEditor | null>,
  rafIdRef: RefObject<number | null>,
): void {
  // 从全局 store 获取 project 与播放状态
  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.currentTime);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const duration = useProjectStore((s) => s.duration);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying);

  // =========================
  // runtime refs（跨模块共享）
  // =========================
  const sinksByAssetRef = useRef<Map<string, { input: Input; sink: CanvasSink }>>(
    new Map(),
  );
  const clipCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const syncedVideoClipIdsRef = useRef<Set<string>>(new Set());

  const videoFrameRequestTimeRef = useRef(0);
  const clipIteratorsRef = useRef<
    Map<string, AsyncGenerator<WrappedCanvas, void, unknown>>
  >(new Map());
  const clipNextFrameRef = useRef<Map<string, WrappedCanvas | null>>(new Map());

  const playbackTimeAtStartRef = useRef(0);
  const wallStartRef = useRef(0);
  const playbackClockStartedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioContextStartTimeRef = useRef(0);
  const audioClockReadyRef = useRef(false);

  // 用 useMemo 固定 runtime 的引用，避免作为依赖导致各模块 effect 反复重跑
  const runtime: VideoPreviewRuntime = useMemo(
    () => ({
      sinksByAssetRef,
      clipCanvasesRef,
      syncedVideoClipIdsRef,
      videoFrameRequestTimeRef,
      clipIteratorsRef,
      clipNextFrameRef,
      playbackTimeAtStartRef,
      wallStartRef,
      playbackClockStartedRef,
      audioContextRef,
      audioContextStartTimeRef,
      audioClockReadyRef,
    }),
    [],
  );

  // sinksReadyTick：sinks 准备完成后触发一次静帧同步刷新
  const [sinksReadyTick, setSinksReadyTick] = useState(0);

  // 暂停时把当前时间记到 ref，下次播放从该时间开始（rAF/异步里用 getState() 读 project/duration/isPlaying，不再用 ref 同步）
  useEffect(() => {
    if (!isPlaying) {
      playbackTimeAtStartRef.current = currentTime;
    }
  }, [isPlaying, currentTime]);

  // 1) sinks 管理（增量创建/清理）
  usePreviewVideoSinks(editorRef, project, runtime, setSinksReadyTick);

  // 2) 暂停/seek：静帧同步（currentTime -> 单帧渲染）。播放时传 null，避免 effect 每帧重跑导致卡顿
  usePreviewVideoStaticFrameSync(
    editorRef,
    project,
    isPlaying ? null : currentTime,
    duration,
    sinksReadyTick,
    runtime,
  );

  // 3) 进入播放态：初始化 iterator 并绘制首帧、启动时钟（effect 内直接读 store.currentTime，避免依赖每帧变化的回调导致 effect 反复重跑）
  usePreviewVideoPlaybackInit(editorRef, project, isPlaying, duration, runtime);

  // 4) 播放态 rAF 循环：推进播放、动态创建 iterator、渲染帧
  usePreviewVideoPlaybackLoop(editorRef, rafIdRef, project, isPlaying, runtime, {
    setCurrentTime,
    setIsPlaying,
  });
}
