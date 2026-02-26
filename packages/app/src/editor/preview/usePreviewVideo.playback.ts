import { useEffect, type RefObject } from "react";
import type { CanvasEditor } from "@vitecut/canvas";
import type { Clip } from "@vitecut/project";
import { useProjectStore } from "@/stores";
import { playbackClock } from "@/editor/preview/playbackClock";
import { getVisibleClipIdsInTrackOrder } from "./usePreviewElementOrder";
import type { VideoPreviewRuntime } from "./usePreviewVideo.shared";
import {
  ensureClipCanvasOnStage,
  drawVideoFrameToCanvasWithFilters,
} from "./usePreviewVideo.shared";
import { getActiveVideoClips, getActiveAudioClips } from "./utils";
import type { Track } from "./utils";

type PlaybackSetters = {
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
};

/** 计算 clip 的 gain 值：轨道静音为 0，否则为 clip.params.volume（0–1，默认 1） */
function getClipGain(clip: Clip, track: Track): number {
  if (track.muted ?? false) {
    return 0;
  }
  const raw = Number(clip.params?.volume);
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 1;
}

/** 与 media-player 一致：遍历 AudioBufferSink.buffers()，按时间戳在 AudioContext 上排程播放；支持多轨（每 clip 一个 iterator、一个 GainNode） */
async function runAudioIterator(
  clip: Clip,
  track: Track,
  iterator: AsyncGenerator<
    { buffer: AudioBuffer; timestamp: number; duration: number },
    void,
    unknown
  >,
  ctx: AudioContext,
  audioContextStartTime: number,
  playbackTimeAtStart: number,
  queuedNodes: Set<AudioBufferSourceNode>,
  gainNodeByClipIdRef: RefObject<Map<string, GainNode>>,
  getPlaybackTime: () => number
): Promise<void> {
  const inPoint = clip.inPoint ?? 0;
  let gainNode = gainNodeByClipIdRef.current.get(clip.id);
  if (!gainNode) {
    gainNode = ctx.createGain();
    gainNode.gain.value = getClipGain(clip, track);
    gainNode.connect(ctx.destination);
    gainNodeByClipIdRef.current.set(clip.id, gainNode);
  }
  for await (const { buffer, timestamp } of iterator) {
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    const timelineTime = clip.start + (timestamp - inPoint);
    const startTimestamp =
      audioContextStartTime + timelineTime - playbackTimeAtStart;
    node.connect(gainNode);
    if (startTimestamp >= ctx.currentTime) {
      node.start(startTimestamp);
    } else {
      // 已过期：从 buffer 中间播；clamp 避免超出 buffer 末尾（解码严重滞后时可能略过一小段，单帧通常 20–40ms 影响很小）
      const offset = ctx.currentTime - startTimestamp;
      const clampedOffset = Math.min(offset, buffer.duration);
      node.start(ctx.currentTime, clampedOffset);
    }
    queuedNodes.add(node);
    node.onended = () => {
      queuedNodes.delete(node);
    };
    if (timelineTime - getPlaybackTime() >= 1) {
      await new Promise<void>((resolve) => {
        const id = setInterval(() => {
          if (timelineTime - getPlaybackTime() < 1) {
            clearInterval(id);
            resolve();
          }
        }, 100);
      });
    }
  }
}

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
  isPlaying: boolean,
  runtime: VideoPreviewRuntime
): void {
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const editor = editorRef.current;
    const proj = useProjectStore.getState().project;
    const dur = useProjectStore.getState().duration;
    if (!proj || !editor) {
      return;
    }

    const {
      sinksByAssetRef,
      clipCanvasesRef,
      clipIteratorsRef,
      clipNextFrameRef,
      playbackPrefetchRef,
      syncedVideoClipIdsRef,
      playbackClockStartedRef,
      playbackTimeAtStartRef,
      wallStartRef,
      audioContextRef,
      audioContextStartTimeRef,
      audioClockReadyRef,
      queuedAudioNodesRef,
      audioIteratorsByClipIdRef,
      gainNodeByClipIdRef,
    } = runtime;

    // 若 effect 因 project 引用变化（如切换轨道静音）重跑而播放仍在进行，用当前真实播放时间，避免用 store 里未每帧同步的陈旧 currentTime 导致时间轴跳回本次起播位置
    const alreadyPlaying = playbackClockStartedRef.current;
    const t0 = alreadyPlaying
      ? playbackClock.currentTime
      : useProjectStore.getState().currentTime;
    // 立即同步播放时钟与起点 ref，避免播放循环首帧 getPlaybackTime() 用上次残留值覆盖 playbackClock 导致时间轴先跳再回
    playbackClock.currentTime = t0;
    playbackTimeAtStartRef.current = t0;
    wallStartRef.current = performance.now() / 1000;
    playbackClockStartedRef.current = true;
    // 播放中仅 project 变化（如切换静音）时，将 audioContext 起点设为当前 ctx 时间，使 getPlaybackTime() = (ctx.now - 起点) + playbackTimeAtStartRef 中的“已过时间”从 0 起算，从而得到 t0 并继续递增，无需改 playbackTimeAtStartRef
    if (alreadyPlaying && audioContextRef.current) {
      audioContextStartTimeRef.current = audioContextRef.current.currentTime;
    }
    clipIteratorsRef.current.clear();
    clipNextFrameRef.current.clear();

    // 与 examples/media-player 一致：用 AudioContext 时钟驱动播放；并在 resume 后为当前可见 clip 启动音频迭代器
    void (async () => {
      const ctx = audioContextRef.current ?? new AudioContext();
      if (!audioContextRef.current) {
        audioContextRef.current = ctx;
      }
      await ctx.resume();
      // 若为播放中重跑（如仅切换静音），用当前 ctx 时间作为新起点，使 getPlaybackTime() 从 t0 继续递增
      audioContextStartTimeRef.current = ctx.currentTime;
      audioClockReadyRef.current = true;

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

      // 启动音频迭代器的通用逻辑（视频 clip 的音轨 + 独立音频 clip 共用）
      const startAudioForClips = (
        clips: { clip: Clip; asset: { id: string }; track: Track }[]
      ) => {
        for (const { clip, asset, track } of clips) {
          const sinkEntry = sinksByAssetRef.current.get(asset.id);
          if (!sinkEntry?.audioSink) {
            continue;
          }
          const inPoint = clip.inPoint ?? 0;
          const sourceTime = inPoint + (Math.min(t0, clip.end) - clip.start);
          const it = sinkEntry.audioSink.buffers(sourceTime, Infinity);
          audioIteratorsByClipIdRef.current.set(clip.id, it);
          void runAudioIterator(
            clip,
            track,
            it,
            ctx,
            audioContextStartTimeRef.current,
            playbackTimeAtStartRef.current,
            queuedAudioNodesRef.current,
            gainNodeByClipIdRef,
            getPlaybackTime
          );
        }
      };

      // 为视频 clip 中的音频轨 + 独立音频 clip 启动迭代器
      startAudioForClips(getActiveVideoClips(proj, t0, dur));
      startAudioForClips(getActiveAudioClips(proj, t0, dur));
    })();

    const active = getActiveVideoClips(proj, t0, dur);

    for (const { clip, asset } of active) {
      const sinkEntry = sinksByAssetRef.current.get(asset.id);
      if (!sinkEntry) {
        continue;
      }
      const videoNativeSize =
        sinkEntry.videoWidth && sinkEntry.videoHeight
          ? { width: sinkEntry.videoWidth, height: sinkEntry.videoHeight }
          : undefined;
      const canvas = ensureClipCanvasOnStage(
        editor,
        clip,
        clipCanvasesRef,
        syncedVideoClipIdsRef,
        videoNativeSize
      );
      if (!canvas) {
        continue;
      }
      const inPoint = clip.inPoint ?? 0;
      const sourceTime = inPoint + (Math.min(t0, clip.end) - clip.start);

      // 优先使用暂停时预取的 iterator + 首帧，点击播放即同步画首帧
      const prefetched = playbackPrefetchRef.current.get(clip.id);
      if (prefetched && Math.abs(prefetched.sourceTime - sourceTime) < 1e-6) {
        playbackPrefetchRef.current.delete(clip.id);
        clipIteratorsRef.current.set(clip.id, prefetched.iterator);
        clipNextFrameRef.current.set(clip.id, prefetched.nextFrame);
        if (prefetched.firstFrame) {
          drawVideoFrameToCanvasWithFilters(
            clip,
            canvas,
            prefetched.firstFrame.canvas as HTMLCanvasElement
          );
          editor.getStage().batchDraw();
        }
        continue;
      }
      if (prefetched) {
        void prefetched.iterator.return?.();
        playbackPrefetchRef.current.delete(clip.id);
      }

      const { sink } = sinkEntry;
      if (!sink) {
        continue;
      }
      void (async () => {
        const it = sink.canvases(sourceTime);
        clipIteratorsRef.current.set(clip.id, it);

        const first = (await it.next()).value ?? null;
        const canvasForDraw = clipCanvasesRef.current.get(clip.id);
        if (first && canvasForDraw) {
          drawVideoFrameToCanvasWithFilters(
            clip,
            canvasForDraw,
            first.canvas as HTMLCanvasElement
          );
          editor.getStage().batchDraw();
        }

        void it.next().then((result) => {
          clipNextFrameRef.current.set(clip.id, result.value ?? null);
        });
      })();
    }

    // 时钟已在上面统一启动，无可见 clip 时也无需再设

    return () => {
      playbackClockStartedRef.current = false;
      for (const [, it] of clipIteratorsRef.current) {
        void it.return?.();
      }
      clipIteratorsRef.current.clear();
      clipNextFrameRef.current.clear();
      for (const [, it] of audioIteratorsByClipIdRef.current) {
        void it.return?.();
      }
      audioIteratorsByClipIdRef.current.clear();
      for (const g of gainNodeByClipIdRef.current.values()) {
        g.disconnect();
      }
      gainNodeByClipIdRef.current.clear();
      for (const node of queuedAudioNodesRef.current) {
        try {
          node.stop();
        } catch {
          // 已结束的 node 可能抛错，忽略
        }
      }
      queuedAudioNodesRef.current.clear();
    };
  }, [editorRef, isPlaying, runtime]);
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
  isPlaying: boolean,
  runtime: VideoPreviewRuntime,
  setters: PlaybackSetters
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
      queuedAudioNodesRef,
      audioIteratorsByClipIdRef,
      gainNodeByClipIdRef,
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
      clip: Clip,
      getTime: () => number,
      dur: number
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
              drawVideoFrameToCanvasWithFilters(
                clip,
                canvas,
                newNext.canvas as HTMLCanvasElement
              );
              editor.getStage().batchDraw();
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

    const render = () => {
      const dur = useProjectStore.getState().duration;
      const playbackTime = getPlaybackTime();
      // 每帧更新全局播放时钟，供 Timeline 读取，避免依赖 store.currentTime
      playbackClock.currentTime = playbackTime;
      const proj = useProjectStore.getState().project;
      const editor = editorRef.current;

      if (proj && editor) {
        const active = getActiveVideoClips(proj, playbackTime, dur);
        const activeIds = new Set(active.map((a) => a.clip.id));
        // 收集当前活跃的音频 clip，复用于清理和后续启动迭代器
        const activeAudio = getActiveAudioClips(proj, playbackTime, dur);
        const activeAudioIds = new Set(activeAudio.map((a) => a.clip.id));

        // 清理：移除已不再可见的 clip 的 iterator/nextFrame、音频迭代器，以及对应画布节点
        for (const clipId of [...clipIteratorsRef.current.keys()]) {
          if (activeIds.has(clipId)) {
            continue;
          }
          const audioIt = audioIteratorsByClipIdRef.current.get(clipId);
          if (audioIt) {
            void audioIt.return?.();
            audioIteratorsByClipIdRef.current.delete(clipId);
          }
          const gainNode = gainNodeByClipIdRef.current.get(clipId);
          if (gainNode) {
            gainNode.disconnect();
          }
          gainNodeByClipIdRef.current.delete(clipId);
          // 移除舞台上的视频节点与相关缓存
          if (syncedVideoClipIdsRef.current.has(clipId)) {
            editor.removeVideo(clipId);
            syncedVideoClipIdsRef.current.delete(clipId);
          }
          clipCanvasesRef.current.delete(clipId);
          clipIteratorsRef.current.delete(clipId);
          clipNextFrameRef.current.delete(clipId);
        }

        // 清理：移除已不再可见的独立音频 clip 的音频迭代器和 GainNode
        for (const clipId of [...audioIteratorsByClipIdRef.current.keys()]) {
          // 跳过视频 clip（已在上面处理）和仍然活跃的音频 clip
          if (activeIds.has(clipId) || activeAudioIds.has(clipId)) {
            continue;
          }
          const audioIt = audioIteratorsByClipIdRef.current.get(clipId);
          if (audioIt) {
            void audioIt.return?.();
            audioIteratorsByClipIdRef.current.delete(clipId);
          }
          const gainNode = gainNodeByClipIdRef.current.get(clipId);
          if (gainNode) {
            gainNode.disconnect();
          }
          gainNodeByClipIdRef.current.delete(clipId);
        }

        // 补齐：播放过程中当 clip 进入可见区时，先确保节点已挂载再动态创建 iterator 并预取帧
        for (const { clip, asset } of active) {
          if (clipIteratorsRef.current.has(clip.id)) {
            continue;
          }
          const sinkEntry = sinksByAssetRef.current.get(asset.id);
          if (!sinkEntry || !sinkEntry.sink) {
            continue;
          }
          const { sink: videoSink } = sinkEntry;
          const videoNativeSizeForClip =
            sinkEntry.videoWidth && sinkEntry.videoHeight
              ? { width: sinkEntry.videoWidth, height: sinkEntry.videoHeight }
              : undefined;
          const canvas = ensureClipCanvasOnStage(
            editor,
            clip,
            clipCanvasesRef,
            syncedVideoClipIdsRef,
            videoNativeSizeForClip
          );
          if (!canvas) {
            continue;
          }
          const inPoint = clip.inPoint ?? 0;
          const sourceTime =
            inPoint + (Math.min(playbackTime, clip.end) - clip.start);

          void (async () => {
            const it = videoSink.canvases(sourceTime);
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
              drawVideoFrameToCanvasWithFilters(
                clip,
                canvas,
                first.canvas as HTMLCanvasElement
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

        // 播放过程中新进入可见区的 clip：若带音频且尚未启动迭代器，则启动（与 media-player 一致）
        const ctx = audioContextRef.current;
        if (ctx && audioClockReadyRef.current) {
          for (const { clip, asset, track } of active) {
            if (audioIteratorsByClipIdRef.current.has(clip.id)) {
              continue;
            }
            const sinkEntry = sinksByAssetRef.current.get(asset.id);
            if (!sinkEntry?.audioSink) {
              continue;
            }
            const inPoint = clip.inPoint ?? 0;
            const sourceTime =
              inPoint + (Math.min(playbackTime, clip.end) - clip.start);
            const it = sinkEntry.audioSink.buffers(sourceTime, Infinity);
            audioIteratorsByClipIdRef.current.set(clip.id, it);
            void runAudioIterator(
              clip,
              track,
              it,
              ctx,
              audioContextStartTimeRef.current,
              playbackTimeAtStartRef.current,
              queuedAudioNodesRef.current,
              gainNodeByClipIdRef,
              getPlaybackTime
            );
          }

          // 播放过程中新进入可见区的独立音频 clip（复用上面已收集的 activeAudio）
          for (const { clip, asset, track } of activeAudio) {
            if (audioIteratorsByClipIdRef.current.has(clip.id)) {
              continue;
            }
            const sinkEntry = sinksByAssetRef.current.get(asset.id);
            if (!sinkEntry?.audioSink) {
              continue;
            }
            const inPoint = clip.inPoint ?? 0;
            const sourceTime =
              inPoint + (Math.min(playbackTime, clip.end) - clip.start);
            const it = sinkEntry.audioSink.buffers(sourceTime, Infinity);
            audioIteratorsByClipIdRef.current.set(clip.id, it);
            void runAudioIterator(
              clip,
              track,
              it,
              ctx,
              audioContextStartTimeRef.current,
              playbackTimeAtStartRef.current,
              queuedAudioNodesRef.current,
              gainNodeByClipIdRef,
              getPlaybackTime
            );
          }

          // 播放中响应独立音频 clip 的轨道静音和音量变化
          for (const { clip, track } of activeAudio) {
            const g = gainNodeByClipIdRef.current.get(clip.id);
            if (g) {
              g.gain.value = getClipGain(clip, track);
            }
          }
        }

        // 播放中响应轨道静音和 clip 音量变化：同步更新该 clip 的 GainNode（每 clip 一个）
        for (const { clip, track } of active) {
          const g = gainNodeByClipIdRef.current.get(clip.id);
          if (g) {
            g.gain.value = getClipGain(clip, track);
          }
        }

        // 消耗 nextFrame 并绘制，然后按 mediabunny 示例逻辑追帧
        for (const { clip } of active) {
          const inPoint = clip.inPoint ?? 0;
          const sourceTime =
            inPoint + (Math.min(playbackTime, clip.end) - clip.start);
          const nextFrame = clipNextFrameRef.current.get(clip.id);
          if (nextFrame && nextFrame.timestamp <= sourceTime) {
            clipNextFrameRef.current.set(clip.id, null);
            const canvas = clipCanvasesRef.current.get(clip.id);
            if (canvas) {
              drawVideoFrameToCanvasWithFilters(
                clip,
                canvas,
                nextFrame.canvas as HTMLCanvasElement
              );
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
  }, [editorRef, rafIdRef, isPlaying, runtime, setCurrentTime, setIsPlaying]);
}
