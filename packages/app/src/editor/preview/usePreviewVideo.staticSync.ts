import { useEffect, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Project } from "@swiftav/project";
import { useProjectStore } from "@/stores";
import type { VideoPreviewRuntime } from "./usePreviewVideo.shared";
import { ensureClipCanvasOnStage } from "./usePreviewVideo.shared";
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
  audioRef: RefObject<HTMLAudioElement | null>,
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
    } = runtime;

    const t = currentTimeWhenPaused;
    const active = getActiveVideoClips(project, t, duration);

    // 暂停/seek 时同步音频：取当前主 clip 的 sourceTime 并 pause，便于下次播放从正确位置出声
    const audio = audioRef.current;
    if (audio) {
      if (active.length > 0) {
        const { clip, asset, track } = active[0];
        const inPoint = clip.inPoint ?? 0;
        const sourceTime =
          inPoint + (Math.min(t, clip.end) - clip.start);
        if (audio.src !== asset.source) {
          audio.src = asset.source;
        }
        audio.currentTime = sourceTime;
        audio.muted = track.muted ?? false;
      }
      audio.pause();
    }

    videoFrameRequestTimeRef.current = t;
    const requestTime = t;

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
      if (!sinkEntry) {
        continue;
      }

      const inPoint = clip.inPoint ?? 0;
      const sourceTime = inPoint + (Math.min(t, clip.end) - clip.start);

      const canvas = ensureClipCanvasOnStage(
        editor,
        clip,
        clipCanvasesRef,
        syncedVideoClipIdsRef,
      );
      if (!canvas) {
        continue;
      }

      // 播放时本 effect 不会跑（currentTimeWhenPaused 为 null），此处双重保险
      if (useProjectStore.getState().isPlaying) {
        continue;
      }

      sinkEntry.sink
        .getCanvas(sourceTime)
        .then((wrapped) => {
          // 若该帧已被新的请求覆盖则丢弃
          if (!wrapped || videoFrameRequestTimeRef.current !== requestTime) {
            return;
          }
          const frameCanvas = wrapped.canvas as HTMLCanvasElement;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(frameCanvas, 0, 0, canvas.width, canvas.height);
          editor.getStage().batchDraw();
        })
        .catch(() => {
          /* 忽略异常 */
        });
    }
  }, [
    editorRef,
    project,
    currentTimeWhenPaused,
    duration,
    sinksReadyTick,
    runtime,
    audioRef,
  ]);
}

