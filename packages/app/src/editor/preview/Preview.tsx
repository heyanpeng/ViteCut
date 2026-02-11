import { useEffect, useRef } from "react";
import { CanvasEditor } from "@swiftav/canvas";
import { CanvasSink, type Input, type WrappedCanvas } from "mediabunny";
import { createInputFromUrl } from "@swiftav/media";
import { useProjectStore } from "@/stores";
import "./Preview.css";

export function Preview() {
  const videoUrl = useProjectStore((s) => s.videoUrl);
  const currentTime = useProjectStore((s) => s.currentTime);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const duration = useProjectStore((s) => s.duration);
  const canvasBackgroundColor = useProjectStore((s) => s.canvasBackgroundColor);
  const setCurrentTimeGlobal = useProjectStore((s) => s.setCurrentTime);
  const setIsPlayingGlobal = useProjectStore((s) => s.setIsPlaying);

  // 容器与画布：挂载点、CanvasEditor 实例、mediabunny 输入/解码输出、用于显示的视频帧 canvas
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CanvasEditor | null>(null);
  const sinkRef = useRef<CanvasSink | null>(null);
  const inputRef = useRef<Input | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 播放与帧流水线：用 ref 在 rAF/异步回调里读最新值，避免闭包陈旧
  const isPlayingRef = useRef(false);
  const playbackTimeAtStartRef = useRef(0); // 本次播放开始时对应的工程时间（秒）
  const wallStartRef = useRef(0); // 本次播放开始的墙上时间（秒），用于 getPlaybackTime
  const durationRef = useRef(0);
  const videoFrameIteratorRef = useRef<AsyncGenerator<
    WrappedCanvas,
    void,
    unknown
  > | null>(null);
  const nextFrameRef = useRef<WrappedCanvas | null>(null); // 下一帧缓存，播放时按时间消费
  const asyncIdRef = useRef(0); // 每次 seek/重新拉迭代器时自增，用于丢弃过期异步结果
  const rafIdRef = useRef<number | null>(null);
  /** 最近一次 seek 请求的时间，用于丢弃过期的 getCanvas 结果，避免拖动时乱序帧导致“快速播到”的错觉 */
  const latestSeekTimeRef = useRef(0);

  // 把 store 的 isPlaying / duration / currentTime 同步到 ref，供 rAF 与异步回调使用
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

  // 初始化：创建 CanvasEditor（16:9 内嵌）、占位文本、窗口 resize 时重算尺寸
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

  // 画布背景色变化时同步到 CanvasEditor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setBackgroundColor(canvasBackgroundColor);
  }, [canvasBackgroundColor]);

  // 视频地址变化时：创建 Input → CanvasSink，创建 displayCanvas 挂到 CanvasEditor，启动 rAF 渲染循环
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

      // 离屏 canvas：从 sink 取帧绘制到此 canvas，再作为“视频”交给 CanvasEditor 显示
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

      // rAF 循环：根据 getPlaybackTime 推进时间；到片尾停播；有 nextFrame 且时间已到则绘制并拉下一帧；同步 currentTime 到 store
      const render = () => {
        const dur = durationRef.current;
        const playbackTime = getPlaybackTime();

        if (isPlayingRef.current && playbackTime >= dur && dur > 0) {
          setIsPlayingGlobal(false);
          setCurrentTimeGlobal(dur);
          playbackTimeAtStartRef.current = dur;
        }

        if (
          isPlayingRef.current &&
          nextFrameRef.current &&
          nextFrameRef.current.timestamp <= playbackTime
        ) {
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
        ctx.drawImage(
          frameCanvas,
          0,
          0,
          displayCanvas.width,
          displayCanvas.height,
        );
        editor.getStage().batchDraw();
      } catch {
        // ignore
      }

      if (cancelled) return;
      startVideoIterator(0);
    };

    // 从 seekTime 起启动异步帧迭代器，预取第一、二帧，第二帧放进 nextFrameRef 供播放消费
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

    // 当前播放时间（秒）：播放中用墙上时间推算，否则用暂停时的 currentTime
    const getPlaybackTime = (): number => {
      if (isPlayingRef.current) {
        return (
          performance.now() / 1000 -
          wallStartRef.current +
          playbackTimeAtStartRef.current
        );
      }
      return playbackTimeAtStartRef.current;
    };

    // 从迭代器拉下一帧：若时间已到则立即绘制并继续拉，否则存入 nextFrameRef 等待下一 rAF
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

  // currentTime（seek/暂停时）变化：按 requestedTime 拉一帧到 displayCanvas，并预拉迭代器下一帧到 nextFrameRef，便于点击播放时无顿感
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
        // 丢弃过期 seek：用户已再次拖动，避免乱序帧
        if (latestSeekTimeRef.current !== requestedTime) return;
        const frameCanvas = wrapped.canvas as HTMLCanvasElement;
        const ctx = displayCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        ctx.drawImage(
          frameCanvas,
          0,
          0,
          displayCanvas.width,
          displayCanvas.height,
        );
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

  // 点击播放时：只把“播放起点”记到 ref，rAF 循环会按 getPlaybackTime 消费已有的 iterator/nextFrame，避免首帧等待
  useEffect(() => {
    if (!isPlaying) return;

    const startTime = useProjectStore.getState().currentTime;
    playbackTimeAtStartRef.current = startTime;
    wallStartRef.current = performance.now() / 1000;
  }, [isPlaying]);

  return <div className="preview-container" ref={containerRef} />;
}
