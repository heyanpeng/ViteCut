import { useEffect, type RefObject } from "react";
import type { CanvasEditor } from "@vitecut/canvas";
import type { Project } from "@vitecut/project";
import { useProjectStore } from "@/stores";
import type { VideoPreviewRuntime } from "./usePreviewVideo.shared";
import {
  ensureClipCanvasOnStage,
  drawVideoFrameToCanvasWithFilters,
} from "./usePreviewVideo.shared";
import { getActiveVideoClips } from "./utils";

/**
 * 非播放状态下的“静帧同步”：
 * - 根据 currentTime 找出当前时刻可见的 video clip；
 * - 确保每个 clip 对应的 canvas 节点已添加到画布；
 * - 调用 sink.getCanvas(time) 拉取单帧并绘制到该 canvas。
 *
 * 播放状态下不在这里取帧（避免与 iterator/rAF 重复工作），播放由 playback 模块负责。
 *
 * currentTimeWhenPaused：仅在暂停时传入 currentTime，播放时传 null。
 * 这样播放时 effect 不会因 currentTime 每帧变化而每帧重跑，避免卡顿。
 */
export function usePreviewVideoStaticFrameSync(
  editorRef: RefObject<CanvasEditor | null>,
  project: Project | null,
  currentTimeWhenPaused: number | null,
  duration: number,
  sinksReadyTick: number,
  runtime: VideoPreviewRuntime,
  resizeTick?: number,
): void {
  useEffect(() => {
    if (currentTimeWhenPaused === null) {
      return;
    }
    const editor = editorRef.current;
    if (!editor || !project) {
      return;
    }

    const {
      sinksByAssetRef,
      clipCanvasesRef,
      syncedVideoClipIdsRef,
      videoFrameRequestTimeRef,
      clipIteratorsRef,
      clipNextFrameRef,
      playbackPrefetchRef,
    } = runtime;

    const t = currentTimeWhenPaused;
    const active = getActiveVideoClips(project, t, duration);

    videoFrameRequestTimeRef.current = t;
    const requestTime = t;

    // 方案 A：清空旧预取，只保留本次暂停时刻的预取（seek 后重新预取）
    for (const entry of playbackPrefetchRef.current.values()) {
      void entry.iterator.return?.();
    }
    playbackPrefetchRef.current.clear();

    // 1) 移除当前不可见的 clip
    const visibleIds = new Set(active.map((a) => a.clip.id));
    for (const id of [...syncedVideoClipIdsRef.current]) {
      if (visibleIds.has(id)) {
        continue;
      }
      editor.removeVideo(id);
      syncedVideoClipIdsRef.current.delete(id);
      clipCanvasesRef.current.delete(id);
      clipIteratorsRef.current.delete(id);
      clipNextFrameRef.current.delete(id);
    }

    // 2) 确保可见 clip 都已挂到画布，并在暂停/seek 时拉单帧
    for (const { clip, asset } of active) {
      const sinkEntry = sinksByAssetRef.current.get(asset.id);
      if (!sinkEntry || !sinkEntry.sink) {
        continue;
      }
      // 提前取出 sink 局部变量，避免异步闭包中使用非空断言
      const { sink } = sinkEntry;

      const inPoint = clip.inPoint ?? 0;
      const sourceTime = inPoint + (Math.min(t, clip.end) - clip.start);

      const canvas = ensureClipCanvasOnStage(
        editor,
        clip,
        clipCanvasesRef,
        syncedVideoClipIdsRef,
        { width: project.width, height: project.height },
      );
      if (!canvas) {
        continue;
      }

      // 播放时本 effect 不会跑（currentTimeWhenPaused 为 null），此处双重保险
      if (useProjectStore.getState().isPlaying) {
        continue;
      }

      sink
        .getCanvas(sourceTime)
        .then((wrapped) => {
          // 若该帧已被新的请求覆盖则丢弃
          if (!wrapped || videoFrameRequestTimeRef.current !== requestTime) {
            return;
          }
          const frameCanvas = wrapped.canvas as HTMLCanvasElement;
          drawVideoFrameToCanvasWithFilters(clip, canvas, frameCanvas);
          editor.getStage().batchDraw();
        })
        .catch(() => {
          /* 忽略异常 */
        });

      // 预创建 iterator 并预取首帧、第二帧，点播放时直接使用
      void (async () => {
        const it = sink.canvases(sourceTime);
        const first = (await it.next()).value ?? null;
        const nextResult = await it.next();
        const next = nextResult.value ?? null;
        if (
          useProjectStore.getState().isPlaying ||
          videoFrameRequestTimeRef.current !== requestTime
        ) {
          void it.return?.();
          return;
        }
        playbackPrefetchRef.current.set(clip.id, {
          sourceTime,
          iterator: it,
          firstFrame: first,
          nextFrame: next,
        });
      })();
    }
  }, [
    editorRef,
    project,
    currentTimeWhenPaused,
    duration,
    sinksReadyTick,
    runtime,
    resizeTick,
  ]);
}
