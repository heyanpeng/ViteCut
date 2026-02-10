import { useEffect, useRef } from "react";
import { CanvasEditor } from "@swiftav/canvas";
import { useProjectStore } from "../../../../stores";
import "./Canvas.css";

export function Canvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CanvasEditor | null>(null);
  const videoUrl = useProjectStore((s) => s.videoUrl);

  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const editor = new CanvasEditor({
      container: containerRef.current,
      width: rect.width || 1280,
      height: rect.height || 720,
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
      editorRef.current.resize(r.width, r.height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      // Konva 会在 Stage destroy 时清理内部资源
      editor.getStage().destroy();
      editorRef.current = null;
    };
  }, []);

  // 当加载了主视频资源时，在画布中添加一个全屏视频元素
  useEffect(() => {
    if (!videoUrl) return;
    if (!editorRef.current) return;

    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const editor = editorRef.current;
    const stage = editor.getStage();
    const { width, height } = stage.size();

    const handleLoadedMetadata = () => {
      editor.addVideo({
        video,
        x: 0,
        y: 0,
        width,
        height,
      });
      editor.playVideo("video-main"); // id 不一定匹配，这里只启动内部动画
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.pause();
    };
  }, [videoUrl]);

  return <div className="canvas-container" ref={containerRef} />;
}
