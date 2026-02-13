import { useEffect, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Project } from "@swiftav/project";
import { useProjectStore } from "@/stores";
import { playbackClock } from "@/editor/preview/playbackClock";
import { getVisibleClipIdsInTrackOrder } from "./usePreviewElementOrder";
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
  audioRef: RefObject<HTMLAudioElement | null>,
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
      audioContextRef,
      audioContextStartTimeRef,
      audioClockReadyRef,
    } = runtime;

    const t0 = useProjectStore.getState().currentTime;
    // 立即同步播放时钟与起点 ref，避免播放循环首帧 getPlaybackTime() 用上次残留值覆盖 playbackClock 导致时间轴先跳再回
    playbackClock.currentTime = t0;
    playbackTimeAtStartRef.current = t0;
    wallStartRef.current = performance.now() / 1000;
    playbackClockStartedRef.current = true;
    clipIteratorsRef.current.clear();
    clipNextFrameRef.current.clear();

    // 与 examples/media-player 一致：用 AudioContext 时钟驱动播放，避免主线程卡顿导致时快时慢
    void (async () => {
      const ctx = audioContextRef.current ?? new AudioContext();
      if (!audioContextRef.current) {
        audioContextRef.current = ctx;
      }
      await ctx.resume();
      audioContextStartTimeRef.current = ctx.currentTime;
      audioClockReadyRef.current = true;
    })();

    const active = getActiveVideoClips(project, t0, duration);

    // 音画同步：用主 clip 的音频源启动 <audio>，与画面一起播放
    const audio = audioRef.current;
    if (audio && active.length > 0) {
      const { clip, asset, track } = active[0];
      const inPoint = clip.inPoint ?? 0;
      const sourceTime = inPoint + (Math.min(t0, clip.end) - clip.start);
      audio.src = asset.source;
      audio.currentTime = sourceTime;
      audio.muted = track.muted ?? false;
      void audio.play().catch(() => {});
    }

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
        }

        // 第二帧后台预取，不阻塞首帧显示
        void it.next().then((result) => {
          clipNextFrameRef.current.set(clip.id, result.value ?? null);
        });
      })();
    }

    // 时钟已在上面统一启动，无可见 clip 时也无需再设
  }, [editorRef, project, isPlaying, duration, runtime, audioRef]);
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
  audioRef: RefObject<HTMLAudioElement | null>,
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
      syncedVideoClipIdsRef,
      clipIteratorsRef,
      clipNextFrameRef,
      playbackClockStartedRef,
      playbackTimeAtStartRef,
      wallStartRef,
      audioContextRef,
      audioContextStartTimeRef,
      audioClockReadyRef,
    } = runtime;

    // 与 examples/media-player 一致：播放时用 AudioContext 时钟，避免主线程卡顿导致时快时慢
    const getPlaybackTime = (): number => {
      if (
        audioClockReadyRef.current &&
        audioContextRef.current &&
        playbackClockStartedRef.current
      ) {
        return (
          audioContextRef.current.currentTime -
          audioContextStartTimeRef.current +
          playbackTimeAtStartRef.current
        );
      }
      return (
        performance.now() / 1000 -
        wallStartRef.current +
        playbackTimeAtStartRef.current
      );
    };

    /**
     * 与 examples/media-player 的 updateNextFrame 一致：
     * - 循环内每次用 getPlaybackTime() 取最新时间再比较；
     * - 落后于当前时间的帧立刻绘制，直到拿到一帧“未来”的帧再缓存为 nextFrame。
     */
    const updateNextFrame = (
      clipId: string,
      clip: { id: string; start: number; end: number; inPoint?: number | null },
      getTime: () => number,
      dur: number,
    ) => {
      const it = clipIteratorsRef.current.get(clipId);
      if (!it) {
        return;
      }

      void (async () => {
        while (true) {
          const result = await it.next();
          const newNext = result.value ?? null;
          if (!newNext) {
            clipNextFrameRef.current.set(clipId, null);
            break;
          }

          if (clipIteratorsRef.current.get(clipId) !== it) {
            break;
          }

          const playbackTime = getTime();
          const inPoint = clip.inPoint ?? 0;
          const sourceTime =
            inPoint +
            (Math.min(Math.min(playbackTime, dur), clip.end) - clip.start);

          if (newNext.timestamp <= sourceTime) {
            const canvas = clipCanvasesRef.current.get(clipId);
            const editor = editorRef.current;
            if (canvas && editor) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(
                  newNext.canvas as HTMLCanvasElement,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                editor.getStage().batchDraw();
              }
            }
            continue;
          }

          clipNextFrameRef.current.set(clipId, newNext);
          break;
        }
      })();
    };

    // 上一帧应用过的叠放顺序，用于避免每帧重复 setElementOrder（仅当可见 clip 或顺序变化时再设）
    let lastOrderIds: string[] = [];
    let lastAudioMuted: boolean | undefined;

    const render = () => {
      const dur = useProjectStore.getState().duration;
      const playbackTime = getPlaybackTime();
      // 每帧更新全局播放时钟，供 Timeline 读取，避免依赖 store.currentTime
      playbackClock.currentTime = playbackTime;
      const proj = useProjectStore.getState().project ?? project;
      const editor = editorRef.current;

      if (proj && editor) {
        const active = getActiveVideoClips(proj, playbackTime, dur);
        const activeIds = new Set(active.map((a) => a.clip.id));

        // 音画同步：主时钟是 AudioContext（getPlaybackTime），audio 从属于它；切换 src 时不改 AudioContext 基准
        const audio = audioRef.current;
        if (audio) {
          if (active.length > 0) {
            const { clip, asset, track } = active[0];
            const inPoint = clip.inPoint ?? 0;
            const sourceTime =
              inPoint + (Math.min(playbackTime, clip.end) - clip.start);
            const srcChanged = audio.src !== asset.source;
            if (srcChanged) {
              audio.src = asset.source;
              audio.currentTime = sourceTime;
            }
            // 仅当音频落后于时间轴时 seek，超前时不 seek 避免跳音
            const drift = sourceTime - audio.currentTime;
            if (drift > 0.2) {
              audio.currentTime = sourceTime;
            }
            const muted = track.muted ?? false;
            if (lastAudioMuted !== muted) {
              lastAudioMuted = muted;
              audio.muted = muted;
            }
            if (audio.paused) {
              void audio.play().catch(() => {});
            }
          } else {
            audio.pause();
          }
        }

        // 清理：移除已不再可见的 clip 的 iterator/nextFrame，以及对应画布节点，避免遮挡下方轨道与内存增长
        for (const clipId of [...clipIteratorsRef.current.keys()]) {
          if (activeIds.has(clipId)) {
            continue;
          }
          // 移除舞台上的视频节点与相关缓存
          if (syncedVideoClipIdsRef.current.has(clipId)) {
            editor.removeVideo(clipId);
            syncedVideoClipIdsRef.current.delete(clipId);
          }
          clipCanvasesRef.current.delete(clipId);
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
            if (!first || !useProjectStore.getState().isPlaying) {
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

        // 消耗 nextFrame 并绘制，然后按 mediabunny 示例逻辑追帧
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
            updateNextFrame(clip.id, clip, getPlaybackTime, dur);
          }
        }

        // 仅当可见 clip 列表或顺序变化时重设叠放顺序（新进入可见区的 clip 会 addVideo 置顶，需纠正）
        const orderIds = getVisibleClipIdsInTrackOrder(proj, playbackTime);
        const orderChanged =
          orderIds.length !== lastOrderIds.length ||
          orderIds.some((id, i) => id !== lastOrderIds[i]);
        if (orderChanged) {
          editor.setElementOrder(orderIds);
          lastOrderIds = orderIds;
        }
      }

      if (playbackClockStartedRef.current) {
        // 仅当「从非结尾处开始播放并自然播到结尾」时停止，避免用户 seek 到结尾再点播放时一帧就停
        const startedFromEnd = playbackTimeAtStartRef.current >= dur && dur > 0;
        if (playbackTime >= dur && dur > 0 && !startedFromEnd) {
          audioRef.current?.pause();
          setIsPlaying(false);
          setCurrentTime(dur);
          playbackTimeAtStartRef.current = dur;
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
  }, [
    editorRef,
    rafIdRef,
    project,
    isPlaying,
    runtime,
    audioRef,
    setCurrentTime,
    setIsPlaying,
  ]);
}

