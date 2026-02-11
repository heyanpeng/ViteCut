import { useEffect, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Project } from "@swiftav/project";
import { useProjectStore } from "@/stores";
import type { VideoPreviewRuntime } from "./usePreviewVideo.shared";
import { ensureClipCanvasOnStage } from "./usePreviewVideo.shared";
import { getActiveVideoClips } from "./utils";

type PlaybackSetters = {
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
};

/**
 * 进入播放态时的初始化：
 * - 为“当前时刻可见”的 clip 建立 iterator，并尽快绘制首帧
 * - 启动播放时钟（wallStartRef / playbackTimeAtStartRef）
 * - 预取第二帧，减少点击播放后的延迟
 *
 * 注意：effect 依赖里不能包含每帧都会变的回调（如 getCurrentTime），否则播放时 setCurrentTime
 * 每帧触发重渲染会不断清空 iterator 导致卡顿；故在 effect 内用 useProjectStore.getState().currentTime 读当前时间。
 */
export function usePreviewVideoPlaybackInit(
  editorRef: RefObject<CanvasEditor | null>,
  project: Project | null,
  isPlaying: boolean,
  duration: number,
  runtime: VideoPreviewRuntime,
): void {
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const editor = editorRef.current;
    if (!project || !editor) {
      return;
    }

    const {
      sinksByAssetRef,
      clipCanvasesRef,
      clipIteratorsRef,
      clipNextFrameRef,
      syncedVideoClipIdsRef,
      playbackClockStartedRef,
      playbackTimeAtStartRef,
      wallStartRef,
    } = runtime;

    const t0 = useProjectStore.getState().currentTime;
    clipIteratorsRef.current.clear();
    clipNextFrameRef.current.clear();
    playbackClockStartedRef.current = false;

    const active = getActiveVideoClips(project, t0, duration);
    for (const { clip, asset } of active) {
      const sinkEntry = sinksByAssetRef.current.get(asset.id);
      if (!sinkEntry) {
        continue;
      }
      // 移动 clip 后可能曾被静态同步移除节点，播放前需确保 canvas 已挂到舞台
      const canvas = ensureClipCanvasOnStage(
        editor,
        clip,
        clipCanvasesRef,
        syncedVideoClipIdsRef,
      );
      if (!canvas) {
        continue;
      }
      const inPoint = clip.inPoint ?? 0;
      const sourceTime = inPoint + (Math.min(t0, clip.end) - clip.start);

      void (async () => {
        const it = sinkEntry.sink.canvases(sourceTime);
        clipIteratorsRef.current.set(clip.id, it);

        const first = (await it.next()).value ?? null;
        const canvasForDraw = clipCanvasesRef.current.get(clip.id);
        if (first && canvasForDraw) {
          const ctx = canvasForDraw.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvasForDraw.width, canvasForDraw.height);
            ctx.drawImage(
              first.canvas as HTMLCanvasElement,
              0,
              0,
              canvasForDraw.width,
              canvasForDraw.height,
            );
          }
          editor.getStage().batchDraw();

          // 由首帧绘制启动时钟（只启动一次，避免多轨重复设）
          if (!playbackClockStartedRef.current) {
            playbackClockStartedRef.current = true;
            playbackTimeAtStartRef.current = t0;
            wallStartRef.current = performance.now() / 1000;
          }
        }

        // 第二帧后台预取，不阻塞首帧显示
        void it.next().then((result) => {
          clipNextFrameRef.current.set(clip.id, result.value ?? null);
        });
      })();
    }

    // 没有任何可见 clip 也要启动时钟，否则播放头不推进
    if (active.length === 0) {
      playbackClockStartedRef.current = true;
      playbackTimeAtStartRef.current = t0;
      wallStartRef.current = performance.now() / 1000;
    }
  }, [editorRef, project, isPlaying, duration, runtime]);
}

/**
 * 播放期间的 rAF 主循环：
 * - 计算 playbackTime 并推进 currentTime
 * - 消耗预取帧（nextFrame）并绘制
 * - 当 clip 进入可见区时动态创建 iterator
 * - 片尾自动停止
 */
export function usePreviewVideoPlaybackLoop(
  editorRef: RefObject<CanvasEditor | null>,
  rafIdRef: RefObject<number | null>,
  project: Project | null,
  isPlaying: boolean,
  runtime: VideoPreviewRuntime,
  setters: PlaybackSetters,
): void {
  const { setCurrentTime, setIsPlaying } = setters;

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const {
      sinksByAssetRef,
      clipCanvasesRef,
      clipIteratorsRef,
      clipNextFrameRef,
      syncedVideoClipIdsRef,
      isPlayingRef,
      playbackClockStartedRef,
      playbackTimeAtStartRef,
      wallStartRef,
      durationRef,
      projectRef,
    } = runtime;

    const getPlaybackTime = (): number => {
      return (
        performance.now() / 1000 -
        wallStartRef.current +
        playbackTimeAtStartRef.current
      );
    };

    const updateNextFrame = (clipId: string) => {
      const it = clipIteratorsRef.current.get(clipId);
      if (!it) {
        return;
      }
      void it.next().then((result) => {
        clipNextFrameRef.current.set(clipId, result.value ?? null);
      });
    };

    const render = () => {
      const dur = durationRef.current;
      const playbackTime = getPlaybackTime();
      const proj = projectRef.current ?? project;
      const editor = editorRef.current;

      if (proj && editor) {
        const active = getActiveVideoClips(proj, playbackTime, dur);
        const activeIds = new Set(active.map((a) => a.clip.id));

        // 清理：移除已不再可见的 clip 的 iterator/nextFrame，避免内存增长
        for (const clipId of [...clipIteratorsRef.current.keys()]) {
          if (activeIds.has(clipId)) {
            continue;
          }
          clipIteratorsRef.current.delete(clipId);
          clipNextFrameRef.current.delete(clipId);
        }

        // 补齐：播放过程中当 clip 进入可见区时，先确保节点已挂载再动态创建 iterator 并预取帧
        for (const { clip, asset } of active) {
          if (clipIteratorsRef.current.has(clip.id)) {
            continue;
          }
          const sinkEntry = sinksByAssetRef.current.get(asset.id);
          if (!sinkEntry) {
            continue;
          }
          const canvas = ensureClipCanvasOnStage(
            editor,
            clip,
            clipCanvasesRef,
            syncedVideoClipIdsRef,
          );
          if (!canvas) {
            continue;
          }
          const inPoint = clip.inPoint ?? 0;
          const sourceTime = inPoint + (Math.min(playbackTime, clip.end) - clip.start);

          void (async () => {
            const it = sinkEntry.sink.canvases(sourceTime);
            clipIteratorsRef.current.set(clip.id, it);

            const first = (await it.next()).value ?? null;
            if (!first || !isPlayingRef.current) {
              return;
            }
            // 若 clip 已离开可见区，则不再绘制该首帧
            if (!activeIds.has(clip.id)) {
              return;
            }

            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(
                first.canvas as HTMLCanvasElement,
                0,
                0,
                canvas.width,
                canvas.height,
              );
              editor.getStage().batchDraw();
            }

            // 第二帧后台预取，不阻塞首帧显示
            void it.next().then((result) => {
              if (clipIteratorsRef.current.get(clip.id) !== it) {
                return;
              }
              clipNextFrameRef.current.set(clip.id, result.value ?? null);
            });
          })();
        }

        // 消耗 nextFrame 并绘制
        for (const { clip } of active) {
          const inPoint = clip.inPoint ?? 0;
          const sourceTime = inPoint + (Math.min(playbackTime, clip.end) - clip.start);
          const nextFrame = clipNextFrameRef.current.get(clip.id);
          if (nextFrame && nextFrame.timestamp <= sourceTime) {
            clipNextFrameRef.current.set(clip.id, null);
            const canvas = clipCanvasesRef.current.get(clip.id);
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(
                  nextFrame.canvas as HTMLCanvasElement,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
              }
              editor.getStage().batchDraw();
            }
            updateNextFrame(clip.id);
          }
        }
      }

      // 仅当时钟已启动后再推进播放头，避免解码等待期间算出错误时间
      if (playbackClockStartedRef.current) {
        if (playbackTime >= dur && dur > 0) {
          setIsPlaying(false);
          setCurrentTime(dur);
          playbackTimeAtStartRef.current = dur;
        } else {
          setCurrentTime(playbackTime);
        }
      }

      rafIdRef.current = requestAnimationFrame(render);
    };

    rafIdRef.current = requestAnimationFrame(render);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [editorRef, rafIdRef, project, isPlaying, runtime, setCurrentTime, setIsPlaying]);
}

