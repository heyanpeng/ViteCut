import { useEffect, useRef, useState, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import { CanvasSink, type Input, type WrappedCanvas } from "mediabunny";
import { createInputFromUrl } from "@swiftav/media";
import { useProjectStore } from "@/stores";
import { getActiveVideoClips } from "./utils";

/**
 * 视频预览：按 project 建 sink、按 currentTime 同步片段与单帧、播放时用 iterator + rAF 驱动。
 */
export function usePreviewVideo(
  editorRef: RefObject<CanvasEditor | null>,
  rafIdRef: RefObject<number | null>,
): void {
  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.currentTime);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const duration = useProjectStore((s) => s.duration);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying);

  const sinksByAssetRef = useRef<Map<string, { input: Input; sink: CanvasSink }>>(new Map());
  const clipCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const syncedVideoClipIdsRef = useRef<Set<string>>(new Set());
  const videoFrameRequestTimeRef = useRef(0);
  const clipIteratorsRef = useRef<Map<string, AsyncGenerator<WrappedCanvas, void, unknown>>>(new Map());
  const clipNextFrameRef = useRef<Map<string, WrappedCanvas | null>>(new Map());

  const projectRef = useRef<typeof project>(null);
  const isPlayingRef = useRef(false);
  const playbackTimeAtStartRef = useRef(0);
  const wallStartRef = useRef(0);
  const durationRef = useRef(0);

  const [sinksReadyTick, setSinksReadyTick] = useState(0);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    if (!isPlaying) {
      playbackTimeAtStartRef.current = currentTime;
    }
  }, [isPlaying, currentTime]);

  /** project → 为每个视频 asset 创建 Input + CanvasSink；完成后 setSinksReadyTick 触发拉首帧 */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!project) {
      for (const id of syncedVideoClipIdsRef.current) {
        editor.removeVideo(id);
      }
      syncedVideoClipIdsRef.current.clear();
      clipCanvasesRef.current.clear();
      sinksByAssetRef.current.clear();
      return;
    }

    const stageSize = editor.getStage().size();
    const width = Math.max(1, Math.round(stageSize.width));
    const height = Math.max(1, Math.round(stageSize.height));
    const videoAssets = project.assets.filter(
      (a) => a.kind === "video" && a.source,
    );

    let cancelled = false;

    const setup = async () => {
      for (const id of syncedVideoClipIdsRef.current) {
        editor.removeVideo(id);
      }
      syncedVideoClipIdsRef.current.clear();
      clipCanvasesRef.current.clear();
      sinksByAssetRef.current.clear();

      for (const asset of videoAssets) {
        if (cancelled) return;
        try {
          const input = createInputFromUrl(asset.source);
          const videoTrack = await input.getPrimaryVideoTrack();
          if (!videoTrack || cancelled) return;
          const sink = new CanvasSink(videoTrack, {
            width,
            height,
            fit: "cover",
            poolSize: 2,
          });
          sinksByAssetRef.current.set(asset.id, { input, sink });
        } catch {
          // 单个 asset 失败不影响其余
        }
      }
      if (!cancelled) {
        setSinksReadyTick((c) => c + 1);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      const ed = editorRef.current;
      if (ed) {
        for (const id of syncedVideoClipIdsRef.current) {
          ed.removeVideo(id);
        }
      }
      syncedVideoClipIdsRef.current.clear();
      clipCanvasesRef.current.clear();
      sinksByAssetRef.current.clear();
    };
  }, [editorRef, project]);

  /** currentTime → 同步可见视频片段；非播放时用 getCanvas 拉单帧 */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !project) return;

    const t = currentTime;
    const active = getActiveVideoClips(project, t);
    const stageSize = editor.getStage().size();
    const stageW = Math.max(1, Math.round(stageSize.width));
    const stageH = Math.max(1, Math.round(stageSize.height));

    videoFrameRequestTimeRef.current = t;
    const requestTime = t;

    const visibleIds = new Set(active.map((a) => a.clip.id));
    for (const id of syncedVideoClipIdsRef.current) {
      if (!visibleIds.has(id)) {
        editor.removeVideo(id);
        syncedVideoClipIdsRef.current.delete(id);
        clipCanvasesRef.current.delete(id);
        clipIteratorsRef.current.delete(id);
        clipNextFrameRef.current.delete(id);
      }
    }

    for (const { clip, asset } of active) {
      const sinkEntry = sinksByAssetRef.current.get(asset.id);
      if (!sinkEntry) continue;

      const inPoint = clip.inPoint ?? 0;
      const sourceTime = inPoint + (t - clip.start);
      const x = clip.transform?.x ?? 0;
      const y = clip.transform?.y ?? 0;
      const scaleX = clip.transform?.scaleX ?? 1;
      const scaleY = clip.transform?.scaleY ?? 1;
      const w = stageW * scaleX;
      const h = stageH * scaleY;

      let canvas = clipCanvasesRef.current.get(clip.id);
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = stageW;
        canvas.height = stageH;
        clipCanvasesRef.current.set(clip.id, canvas);
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

      if (isPlayingRef.current) continue;

      sinkEntry.sink
        .getCanvas(sourceTime)
        .then((wrapped) => {
          if (!wrapped || videoFrameRequestTimeRef.current !== requestTime) return;
          const frameCanvas = wrapped.canvas as HTMLCanvasElement;
          const ctx = canvas!.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas!.width, canvas!.height);
          ctx.drawImage(frameCanvas, 0, 0, canvas!.width, canvas!.height);
          editor.getStage().batchDraw();
        })
        .catch(() => {});
    }
  }, [editorRef, project, currentTime, sinksReadyTick]);

  /** 播放开始 → 为当前可见 clip 建 iterator，预取两帧 */
  useEffect(() => {
    if (!isPlaying) return;

    const proj = projectRef.current;
    const editor = editorRef.current;
    if (!proj || !editor) return;

    const t0 = useProjectStore.getState().currentTime;
    playbackTimeAtStartRef.current = t0;
    wallStartRef.current = performance.now() / 1000;
    clipIteratorsRef.current.clear();
    clipNextFrameRef.current.clear();

    const active = getActiveVideoClips(proj, t0);
    for (const { clip, asset } of active) {
      const sinkEntry = sinksByAssetRef.current.get(asset.id);
      if (!sinkEntry) continue;
      const inPoint = clip.inPoint ?? 0;
      const sourceTime = inPoint + (t0 - clip.start);
      void (async () => {
        const it = sinkEntry.sink.canvases(sourceTime);
        clipIteratorsRef.current.set(clip.id, it);
        const first = (await it.next()).value ?? null;
        const second = (await it.next()).value ?? null;
        clipNextFrameRef.current.set(clip.id, second);
        const canvas = clipCanvasesRef.current.get(clip.id);
        if (first && canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(first.canvas as HTMLCanvasElement, 0, 0, canvas.width, canvas.height);
          }
          editor.getStage().batchDraw();
        }
      })();
    }
  }, [editorRef, isPlaying]);

  /** 播放时 rAF：getPlaybackTime、消费 nextFrame、setCurrentTime、片尾停播 */
  useEffect(() => {
    if (!isPlaying) return;

    const getPlaybackTime = (): number => {
      return (
        performance.now() / 1000 -
        wallStartRef.current +
        playbackTimeAtStartRef.current
      );
    };

    const updateNextFrame = (clipId: string) => {
      const it = clipIteratorsRef.current.get(clipId);
      if (!it) return;
      void it.next().then((result) => {
        const value = result.value ?? null;
        clipNextFrameRef.current.set(clipId, value);
      });
    };

    const render = () => {
      const dur = durationRef.current;
      const playbackTime = getPlaybackTime();
      const proj = projectRef.current;
      const editor = editorRef.current;

      if (proj && editor) {
        const active = getActiveVideoClips(proj, playbackTime);
        for (const { clip } of active) {
          const inPoint = clip.inPoint ?? 0;
          const sourceTime = inPoint + (playbackTime - clip.start);
          const nextFrame = clipNextFrameRef.current.get(clip.id);
          if (nextFrame && nextFrame.timestamp <= sourceTime) {
            clipNextFrameRef.current.set(clip.id, null);
            const canvas = clipCanvasesRef.current.get(clip.id);
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(nextFrame.canvas as HTMLCanvasElement, 0, 0, canvas.width, canvas.height);
              }
              editor.getStage().batchDraw();
            }
            updateNextFrame(clip.id);
          }
        }
      }

      if (playbackTime >= dur && dur > 0) {
        setIsPlaying(false);
        setCurrentTime(dur);
        playbackTimeAtStartRef.current = dur;
      } else {
        setCurrentTime(playbackTime);
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
  }, [isPlaying, setCurrentTime, setIsPlaying, editorRef, rafIdRef]);
}
