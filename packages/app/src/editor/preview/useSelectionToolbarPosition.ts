/**
 * 跟踪选中元素位置，用于 SelectionToolbar 跟随定位
 *
 * 当选中有元素时，通过 requestAnimationFrame 持续获取元素在预览容器内的坐标，
 * 直接更新 toolbarRef 的 style，与 Konva 同帧绘制，避免 React 批处理导致的延迟和间隔漂移。
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import { SELECTION_TOOLBAR_GAP } from "./constants";

export type ToolbarPosition = {
  /** 水平中心（用于 Toolbar 居中） */
  x: number;
  /** 元素顶部 y 坐标（用于固定 Toolbar 与元素的间隔） */
  elementTop: number;
} | null;

export function useSelectionToolbarPosition(
  editorRef: RefObject<CanvasEditor | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  toolbarRef: RefObject<HTMLDivElement | null>,
  selectedClipId: string | null,
  visible: boolean,
): ToolbarPosition {
  const [position, setPosition] = useState<ToolbarPosition>(null);
  const hasPositionRef = useRef(false);

  useEffect(() => {
    if (
      !visible ||
      !selectedClipId ||
      !editorRef.current ||
      !containerRef.current
    ) {
      hasPositionRef.current = false;
      setPosition(null);
      if (toolbarRef.current) {
        toolbarRef.current.style.visibility = "hidden";
      }
      return;
    }

    const editor = editorRef.current;
    const container = containerRef.current;

    let rafId: number;

    const updatePosition = () => {
      const rect = editor.getElementRectInViewport(selectedClipId);
      const containerRect = container.getBoundingClientRect();
      if (!rect) {
        if (toolbarRef.current) {
          toolbarRef.current.style.visibility = "hidden";
        }
        rafId = requestAnimationFrame(updatePosition);
        return;
      }
      const x = rect.x - containerRect.left + rect.width / 2;
      const elementTop = rect.y - containerRect.top;
      const top = elementTop - SELECTION_TOOLBAR_GAP;

      // 直接更新 DOM，与 Konva 同帧绘制，消除延迟
      if (toolbarRef.current) {
        toolbarRef.current.style.left = `${x}px`;
        toolbarRef.current.style.top = `${top}px`;
        toolbarRef.current.style.transform = "translate(-50%, -100%)";
        toolbarRef.current.style.visibility = "visible";
      }

      if (!hasPositionRef.current) {
        hasPositionRef.current = true;
        setPosition({ x, elementTop });
      }
      rafId = requestAnimationFrame(updatePosition);
    };

    rafId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafId);
  }, [editorRef, containerRef, toolbarRef, selectedClipId, visible]);

  return position;
}
