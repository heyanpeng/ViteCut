import { useEffect, useRef, useState } from "react";
import { CanvasEditor } from "@swiftav/canvas";
import { CanvasSink, type Input, type WrappedCanvas } from "mediabunny";
import { createInputFromUrl } from "@swiftav/media";
import type { Clip, Project } from "@swiftav/project";
import { useProjectStore } from "@/stores";
import "./Preview.css";

type Track = Project["tracks"][number];

/** 当前时间下可见的视频片段（含 clip、track、asset），按轨道顺序 */
function getActiveVideoClips(
  project: Project,
  t: number,
): Array<{ clip: Clip; track: Track; asset: { id: string; source: string } }> {
  const out: Array<{
    clip: Clip;
    track: Track;
    asset: { id: string; source: string };
  }> = [];
  for (const track of project.tracks) {
    if (track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.kind !== "video" || clip.start > t || clip.end <= t) continue;
      const asset = project.assets.find((a) => a.id === clip.assetId);
      if (!asset || asset.kind !== "video" || !asset.source) continue;
      out.push({ clip, track, asset: { id: asset.id, source: asset.source } });
    }
  }
  return out;
}

export function Preview() {
  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.currentTime);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const duration = useProjectStore((s) => s.duration);
  const canvasBackgroundColor = useProjectStore((s) => s.canvasBackgroundColor);
  const setCurrentTimeGlobal = useProjectStore((s) => s.setCurrentTime);
  const setIsPlayingGlobal = useProjectStore((s) => s.setIsPlaying);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CanvasEditor | null>(null);

  /** 每个视频 asset 一个 Input + CanvasSink，按 assetId 存 */
  const sinksByAssetRef = useRef<
    Map<string, { input: Input; sink: CanvasSink }>
  >(new Map());
  /** 每个“当前在画布上的”视频 clip 对应一个 canvas，用于画该片段当前帧 */
  const clipCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  /** 已通过 addVideo 同步到画布的视频 clip id */
  const syncedVideoClipIdsRef = useRef<Set<string>>(new Set());
  /** 当前这一轮“拉帧”的请求时间（seek 时用于丢弃过期结果） */
  const videoFrameRequestTimeRef = useRef(0);
  /** 播放时每个 active clip 的帧迭代器，用于预取下一帧 */
  const clipIteratorsRef = useRef<Map<string, AsyncGenerator<WrappedCanvas, void, unknown>>>(new Map());
  /** 播放时每个 clip 的下一帧缓存，rAF 内按时间消费 */
  const clipNextFrameRef = useRef<Map<string, WrappedCanvas | null>>(new Map());

  const projectRef = useRef<Project | null>(null);
  const isPlayingRef = useRef(false);
  const playbackTimeAtStartRef = useRef(0);
  const wallStartRef = useRef(0);
  const durationRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const syncedTextClipIdsRef = useRef<Set<string>>(new Set());
  /** project 下视频 sink 创建完成后自增，用于让“同步视频片段”effect 再跑一次以拉首帧 */
  const [sinksReadyTick, setSinksReadyTick] = useState(0);

  // 把 store 的 isPlaying / duration / currentTime 同步到 ref，供 rAF 与异步回调使用
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

  // 初始化：创建 CanvasEditor（16:9 内嵌）、窗口 resize 时重算尺寸（文本由“文本轨道片段”在下方 effect 中同步）
  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const targetAspect = 16 / 9;
    let width = rect.width;
    let height = rect.height;

    if (!width || !height) return;

    const containerAspect = rect.width / rect.height;
    if (containerAspect > targetAspect) {
      height = rect.height;
      width = rect.height * targetAspect;
    } else {
      width = rect.width;
      height = rect.width / targetAspect;
    }

    const editor = new CanvasEditor({
      container: containerRef.current,
      width,
      height,
      backgroundColor: canvasBackgroundColor,
    });

    editorRef.current = editor;

    const handleResize = () => {
      if (!containerRef.current || !editorRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const targetAspect = 16 / 9;
      let newWidth = r.width;
      let newHeight = r.height;

      if (!newWidth || !newHeight) return;

      const containerAspect = r.width / r.height;
      if (containerAspect > targetAspect) {
        newHeight = r.height;
        newWidth = r.height * targetAspect;
      } else {
        newWidth = r.width;
        newHeight = r.width / targetAspect;
      }

      editorRef.current.resize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      editor.getStage().destroy();
      editorRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // 画布背景色变化时同步到 CanvasEditor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setBackgroundColor(canvasBackgroundColor);
  }, [canvasBackgroundColor]);

  // 按 currentTime 同步“当前可见”的文本轨道片段到画布：在时间范围内的文本 clip 才显示
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!project) {
      for (const id of syncedTextClipIdsRef.current) {
        editor.removeText(id);
      }
      syncedTextClipIdsRef.current.clear();
      return;
    }

    const t = currentTime;
    const visibleTextClips: Array<{
      id: string;
      text: string;
      x: number;
      y: number;
      fontSize: number;
      fill: string;
    }> = [];

    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        if (clip.kind !== "text" || clip.start > t || clip.end <= t) continue;
        const asset = project.assets.find((a) => a.id === clip.assetId);
        const params = (clip.params ?? {}) as {
          text?: string;
          fontSize?: number;
          fill?: string;
        };
        visibleTextClips.push({
          id: clip.id,
          text: params.text ?? asset?.textMeta?.initialText ?? "",
          x: clip.transform?.x ?? 0,
          y: clip.transform?.y ?? 0,
          fontSize: params.fontSize ?? 32,
          fill: params.fill ?? "#ffffff",
        });
      }
    }

    const visibleIds = new Set(visibleTextClips.map((c) => c.id));
    for (const id of syncedTextClipIdsRef.current) {
      if (!visibleIds.has(id)) {
        editor.removeText(id);
        syncedTextClipIdsRef.current.delete(id);
      }
    }
    for (const clip of visibleTextClips) {
      if (syncedTextClipIdsRef.current.has(clip.id)) {
        editor.updateText(clip.id, {
          text: clip.text,
          x: clip.x,
          y: clip.y,
          fontSize: clip.fontSize,
          fill: clip.fill,
        });
      } else {
        editor.addText({
          id: clip.id,
          text: clip.text,
          x: clip.x,
          y: clip.y,
          fontSize: clip.fontSize,
          fill: clip.fill,
        });
        syncedTextClipIdsRef.current.add(clip.id);
      }
    }
  }, [project, currentTime]);

  // project 变化时：为每个视频 asset 创建 Input + CanvasSink；清理旧 sink 与画布上的视频元素
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
      // 先移除画布上所有已同步的视频元素并清空 clip 画布
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
  }, [project]);

  // 按 currentTime 同步“当前可见”的视频片段：add/remove 视频元素，对每个 active clip 拉一帧画到其 canvas
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

      // 播放时由 rAF + iterator 驱动绘帧，此处只做 seek/暂停时的单帧拉取
      if (isPlayingRef.current) continue;

      sinkEntry.sink
        .getCanvas(sourceTime)
        .then((wrapped) => {
          if (!wrapped || videoFrameRequestTimeRef.current !== requestTime)
            return;
          const frameCanvas = wrapped.canvas as HTMLCanvasElement;
          const ctx = canvas!.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas!.width, canvas!.height);
          ctx.drawImage(frameCanvas, 0, 0, canvas!.width, canvas!.height);
          editor.getStage().batchDraw();
        })
        .catch(() => {});
    }
  }, [project, currentTime, sinksReadyTick]);

  // 播放开始时：为每个当前可见的视频 clip 从 sourceTime 起建 iterator，预取两帧（画第一帧，第二帧进 clipNextFrameRef）
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
  }, [isPlaying]);

  // 播放时：rAF 内按 playbackTime 消费各 clip 的 nextFrame 并拉下一帧，推进 currentTime，到片尾停播
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
        setIsPlayingGlobal(false);
        setCurrentTimeGlobal(dur);
        playbackTimeAtStartRef.current = dur;
      } else {
        setCurrentTimeGlobal(playbackTime);
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
  }, [isPlaying, setCurrentTimeGlobal, setIsPlayingGlobal]);

  return <div className="preview-container" ref={containerRef} />;
}
