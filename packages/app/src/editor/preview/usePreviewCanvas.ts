import { useEffect, useRef, type RefObject } from "react";
import { CanvasEditor } from "@swiftav/canvas";
import { useProjectStore } from "@/stores";

/**
 * 创建并维护预览画布：CanvasEditor 初始化（16:9 内嵌）、resize 监听、背景色同步。
 * 卸载时销毁 stage 并取消 rAF（通过传入的 rafIdRef）。
 * @param containerRef 画布挂载的 div 的 ref
 * @param rafIdRef 播放用 rAF 的 id，卸载时在此 cancel
 * @returns editorRef 供文本/视频同步使用
 */
export function usePreviewCanvas(
  containerRef: RefObject<HTMLDivElement | null>,
  rafIdRef: RefObject<number | null>,
): RefObject<CanvasEditor | null> {
  const editorRef = useRef<CanvasEditor | null>(null);
  const canvasBackgroundColor = useProjectStore((s) => s.canvasBackgroundColor);

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

    /** 窗口 resize 时按 16:9 重算画布尺寸并调用 editor.resize */
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

    /** 卸载时移除 resize 监听、销毁 stage、取消 rAF */
    return () => {
      window.removeEventListener("resize", handleResize);
      editor.getStage().destroy();
      editorRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    // 仅挂载时初始化，卸载时 cleanup；containerRef/rafIdRef 在闭包内使用
  }, []);

  /** 画布背景色变化时同步到 CanvasEditor 的 setBackgroundColor */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setBackgroundColor(canvasBackgroundColor);
  }, [canvasBackgroundColor]);

  return editorRef;
}
