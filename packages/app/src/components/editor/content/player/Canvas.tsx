import { useEffect, useRef } from "react";
import { CanvasEditor } from "@swiftav/canvas";
import { CanvasSink, type Input, type WrappedCanvas } from "mediabunny";
import { createInputFromUrl } from "@swiftav/media";
import { useProjectStore } from "../../../../stores";
import "./Canvas.css";

export function Canvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CanvasEditor | null>(null);
  const videoUrl = useProjectStore((s) => s.videoUrl);
  const currentTime = useProjectStore((s) => s.currentTime);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const duration = useProjectStore((s) => s.duration);
  const canvasBackgroundColor = useProjectStore((s) => s.canvasBackgroundColor);
  const setCurrentTimeGlobal = useProjectStore((s) => s.setCurrentTime);
  const setIsPlayingGlobal = useProjectStore((s) => s.setIsPlaying);

  const sinkRef = useRef<CanvasSink | null>(null);
  const inputRef = useRef<Input | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isPlayingRef = useRef(false);
  const playbackTimeAtStartRef = useRef(0);
  const wallStartRef = useRef(0);
  const durationRef = useRef(0);
  const videoFrameIteratorRef = useRef<AsyncGenerator<WrappedCanvas, void, unknown> | null>(null);
  const nextFrameRef = useRef<WrappedCanvas | null>(null);
  const asyncIdRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  /** 最近一次 seek 请求的时间，用于丢弃过期的 getCanvas 结果，避免拖动时乱序帧导致“快速播到”的错觉 */
  const latestSeekTimeRef = useRef(0);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    if (!isPlaying) {
      playbackTimeAtStartRef.current = currentTime;
    }
  }, [isPlaying, currentTime]);

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

    editor.addText({
      text: "SwiftAV Canvas",
      x: 40,
      y: 40,
      fontSize: 32,
      fill: "#ffffff",
    });

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
  // 背景颜色变化时更新 CanvasEditor 背景
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setBackgroundColor(canvasBackgroundColor);
  }, [canvasBackgroundColor]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      if (!videoUrl) return;
      if (!editorRef.current) return;

      const editor = editorRef.current;
      const stage = editor.getStage();
      const stageSize = stage.size();
      const width = Math.max(1, Math.round(stageSize.width));
      const height = Math.max(1, Math.round(stageSize.height));

      const input = createInputFromUrl(videoUrl);
      inputRef.current = input;
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack || cancelled) return;

      const sink = new CanvasSink(videoTrack, {
        width,
        height,
        fit: "cover",
        poolSize: 2,
      });
      sinkRef.current = sink;

      const displayCanvas = document.createElement("canvas");
      displayCanvas.width = width;
      displayCanvas.height = height;
      displayCanvasRef.current = displayCanvas;

      editor.addVideo({
        id: "video-main",
        video: displayCanvas,
        x: 0,
        y: 0,
        width,
        height,
      });

      playbackTimeAtStartRef.current = 0;

      const render = () => {
        const dur = durationRef.current;
        const playbackTime = getPlaybackTime();

        if (isPlayingRef.current && playbackTime >= dur && dur > 0) {
          setIsPlayingGlobal(false);
          setCurrentTimeGlobal(dur);
          playbackTimeAtStartRef.current = dur;
        }

        if (isPlayingRef.current && nextFrameRef.current && nextFrameRef.current.timestamp <= playbackTime) {
          const frame = nextFrameRef.current;
          nextFrameRef.current = null;
          const ctx = displayCanvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
            ctx.drawImage(frame.canvas as HTMLCanvasElement, 0, 0);
          }
          editor.getStage().batchDraw();
          void updateNextFrame();
        }

        if (isPlayingRef.current) {
          setCurrentTimeGlobal(playbackTime);
        }

        rafIdRef.current = requestAnimationFrame(render);
      };

      rafIdRef.current = requestAnimationFrame(render);

      try {
        const wrapped = await sink.getCanvas(0);
        if (!wrapped || cancelled) return;
        const frameCanvas = wrapped.canvas as HTMLCanvasElement;
        const ctx = displayCanvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(frameCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
        editor.getStage().batchDraw();
      } catch {
        // ignore
      }

      if (cancelled) return;
      startVideoIterator(0);
    };

    const startVideoIterator = async (seekTime: number) => {
      const s = sinkRef.current;
      const d = displayCanvasRef.current;
      const e = editorRef.current;
      if (!s || !d || !e) return;

      asyncIdRef.current += 1;
      const currentAsyncId = asyncIdRef.current;

      void videoFrameIteratorRef.current?.return?.();
      videoFrameIteratorRef.current = s.canvases(seekTime);

      const it = videoFrameIteratorRef.current;
      const firstFrame = (await it.next()).value ?? null;
      const secondFrame = (await it.next()).value ?? null;

      if (currentAsyncId !== asyncIdRef.current) return;

      nextFrameRef.current = secondFrame;

      if (firstFrame) {
        const ctx = d.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, d.width, d.height);
          ctx.drawImage(firstFrame.canvas as HTMLCanvasElement, 0, 0);
        }
        e.getStage().batchDraw();
      }
    };

    const getPlaybackTime = (): number => {
      if (isPlayingRef.current) {
        return performance.now() / 1000 - wallStartRef.current + playbackTimeAtStartRef.current;
      }
      return playbackTimeAtStartRef.current;
    };

    const updateNextFrame = async () => {
      const it = videoFrameIteratorRef.current;
      const d = displayCanvasRef.current;
      const e = editorRef.current;
      if (!it || !d || !e) return;

      const currentAsyncId = asyncIdRef.current;

      while (true) {
        const result = await it.next();
        const newNextFrame = result.value ?? null;

        if (!newNextFrame) break;
        if (currentAsyncId !== asyncIdRef.current) break;

        const playbackTime = getPlaybackTime();
        if (newNextFrame.timestamp <= playbackTime) {
          const ctx = d.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, d.width, d.height);
            ctx.drawImage(newNextFrame.canvas as HTMLCanvasElement, 0, 0);
          }
          e.getStage().batchDraw();
        } else {
          nextFrameRef.current = newNextFrame;
          break;
        }
      }
    };

    void setup();

    return () => {
      cancelled = true;
      sinkRef.current = null;
      displayCanvasRef.current = null;
      inputRef.current = null;
      videoFrameIteratorRef.current = null;
      nextFrameRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [videoUrl, setCurrentTimeGlobal, setIsPlayingGlobal]);

  useEffect(() => {
    const sink = sinkRef.current;
    const displayCanvas = displayCanvasRef.current;
    const editor = editorRef.current;
    if (!sink || !displayCanvas || !editor) return;

    if (isPlayingRef.current) return;

    const requestedTime = currentTime;
    latestSeekTimeRef.current = requestedTime;

    let cancelled = false;

    const renderAtTime = async () => {
      try {
        const wrapped = await sink.getCanvas(requestedTime);
        if (!wrapped || cancelled) return;
        if (latestSeekTimeRef.current !== requestedTime) return;
        const frameCanvas = wrapped.canvas as HTMLCanvasElement;
        const ctx = displayCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        ctx.drawImage(frameCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
        editor.getStage().batchDraw();

        if (cancelled || latestSeekTimeRef.current !== requestedTime) return;
        asyncIdRef.current += 1;
        const currentAsyncId = asyncIdRef.current;
        void videoFrameIteratorRef.current?.return?.();
        videoFrameIteratorRef.current = sink.canvases(requestedTime);
        const it = videoFrameIteratorRef.current;
        await it.next();
        const secondFrame = (await it.next()).value ?? null;
        if (currentAsyncId !== asyncIdRef.current) return;
        nextFrameRef.current = secondFrame;
      } catch {
        // ignore
      }
    };

    void renderAtTime();

    return () => {
      cancelled = true;
    };
  }, [currentTime]);

  // 点击播放时只启动时钟，复用 seek 时已预拉取的 iterator 和 nextFrame，避免等两帧解码造成“顿一下”
  useEffect(() => {
    if (!isPlaying) return;

    const startTime = useProjectStore.getState().currentTime;
    playbackTimeAtStartRef.current = startTime;
    wallStartRef.current = performance.now() / 1000;
  }, [isPlaying]);

  return <div className="canvas-container" ref={containerRef} />;
}
