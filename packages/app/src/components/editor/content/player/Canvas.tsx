import { useEffect, useRef } from "react";
import { CanvasEditor } from "@swiftav/canvas";
import { CanvasSink, type Input } from "mediabunny";
import { createInputFromUrl } from "@swiftav/media";
import { useProjectStore } from "../../../../stores";
import "./Canvas.css";

export function Canvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CanvasEditor | null>(null);
  const videoUrl = useProjectStore((s) => s.videoUrl);
  const currentTime = useProjectStore((s) => s.currentTime);

  // mediabunny 解码相关引用
  const sinkRef = useRef<CanvasSink | null>(null);
  const inputRef = useRef<Input | null>(null);
  // 真正挂到 CanvasEditor 上作为 image 源的展示 canvas，一直复用同一个实例
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const targetAspect = 16 / 9;
    let width = rect.width;
    let height = rect.height;

    // 容器尺寸不可用时直接返回，等待下一次布局变更
    if (!width || !height) return;

    const containerAspect = rect.width / rect.height;
    if (containerAspect > targetAspect) {
      // 宽比较富余，以高度为基准撑满
      height = rect.height;
      width = rect.height * targetAspect;
    } else {
      // 高比较富余，以宽度为基准撑满
      width = rect.width;
      height = rect.width / targetAspect;
    }

    const editor = new CanvasEditor({
      container: containerRef.current,
      width,
      height,
      backgroundColor: "#000000",
    });

    editorRef.current = editor;

    // 示例：添加一段占位文本
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
      // Konva 会在 Stage destroy 时清理内部资源
      editor.getStage().destroy();
      editorRef.current = null;
    };
  }, []);

  // 当加载了主视频资源时，使用 mediabunny 创建 CanvasSink，
  // 并在画布中添加一个使用 displayCanvas 作为帧源的全屏视频元素。
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      if (!videoUrl) return;
      if (!editorRef.current) return;

      const editor = editorRef.current;
      const stage = editor.getStage();
      const stageSize = stage.size();
      // mediabunny CanvasSink 要求 width/height 为正整数，stage 尺寸可能是 0 或浮点数
      const width = Math.max(1, Math.round(stageSize.width));
      const height = Math.max(1, Math.round(stageSize.height));

      // 通过 URL 创建 mediabunny Input，并获取主视频轨
      const input = createInputFromUrl(videoUrl);
      inputRef.current = input;
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack || cancelled) return;

      // 创建 CanvasSink，用于按时间获取渲染好的帧 canvas
      const sink = new CanvasSink(videoTrack, {
        width,
        height,
        fit: "cover",
      });
      sinkRef.current = sink;

      // 创建一个供 CanvasEditor 使用的展示 canvas，后续始终复用同一个实例
      const displayCanvas = document.createElement("canvas");
      displayCanvas.width = width;
      displayCanvas.height = height;
      displayCanvasRef.current = displayCanvas;

      // 将展示 canvas 挂到 CanvasEditor 上
      editor.addVideo({
        id: "video-main",
        video: displayCanvas,
        x: 0,
        y: 0,
        width,
        height,
      });

      // 预渲染第 0 秒的画面，避免一开始是纯黑
      try {
        const wrapped = await sink.getCanvas(0);
        if (!wrapped || cancelled) return;
        const frameCanvas = wrapped.canvas as HTMLCanvasElement;
        const ctx = displayCanvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(frameCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
        editor.getStage().batchDraw();
      } catch {
        // 忽略解码错误，由上层做错误提示
      }
    };

    void setup();

    return () => {
      cancelled = true;
      sinkRef.current = null;
      displayCanvasRef.current = null;
      inputRef.current = null;
    };
  }, [videoUrl]);

  // 当全局 currentTime 变化时，主动 seek 到对应时间，以便响应时间线点击/拖动
  useEffect(() => {
    const sink = sinkRef.current;
    const displayCanvas = displayCanvasRef.current;
    const editor = editorRef.current;
    if (!sink || !displayCanvas || !editor) return;

    let cancelled = false;

    const renderAtTime = async () => {
      try {
        const wrapped = await sink.getCanvas(currentTime);
        if (!wrapped || cancelled) return;
        const frameCanvas = wrapped.canvas as HTMLCanvasElement;
        const ctx = displayCanvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(frameCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
        editor.getStage().batchDraw();
      } catch {
        // 解码失败时暂时忽略，后续可接入全局错误提示
      }
    };

    void renderAtTime();

    return () => {
      cancelled = true;
    };
  }, [currentTime]);

  return <div className="canvas-container" ref={containerRef} />;
}
