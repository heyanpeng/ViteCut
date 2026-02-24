import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { CanvasEditor } from "@vitecut/canvas";
import { useProjectStore } from "@/stores";

/**
 * 创建并维护预览画布：
 * - 初始化 CanvasEditor，自动适应容器大小（固定 16:9 比例，居中内嵌）
 * - 监听 resize 自动调整画布尺寸
 * - 画布背景色支持动态同步
 * - 卸载时销毁 stage 并清理 rAF
 *
 * @param containerRef - 画布挂载用的 div ref，由 Preview 组件负责绑定
 * @param rafIdRef - 当前 requestAnimationFrame id，供外部清理/取消
 * @returns [editorRef, resizeTick] - 画布编辑器实例 + resize 计数器（每次画布尺寸变化递增，供同步 hooks 作为依赖触发重新同步）
 */
export function usePreviewCanvas(
  containerRef: RefObject<HTMLDivElement | null>,
  rafIdRef: RefObject<number | null>,
): [RefObject<CanvasEditor | null>, number] {
  // 存储 CanvasEditor 实例，挂载/卸载生命周期管理
  const editorRef = useRef<CanvasEditor | null>(null);
  // resize 计数器：每次画布尺寸变化递增，供同步 hooks 作为依赖触发元素重新同步
  const [resizeTick, setResizeTick] = useState(0);
  const bumpResizeTick = useCallback(() => setResizeTick((n) => n + 1), []);

  // 画布宽高比：有 project 用 project，无 project 用 preferredCanvasSize
  const project = useProjectStore((s) => s.project);
  const preferredCanvasSize = useProjectStore((s) => s.preferredCanvasSize);
  const canvasAspect =
    project != null
      ? project.width / project.height
      : preferredCanvasSize.width / preferredCanvasSize.height;

  useEffect(() => {
    // 若无容器节点，直接跳过
    if (!containerRef.current) {
      return;
    }

    // 获取容器宽高，据此适配画布比例（来自 project 或 preferredCanvasSize）
    const rect = containerRef.current.getBoundingClientRect();
    const targetAspect = canvasAspect;
    let width = rect.width;
    let height = rect.height;

    if (!width || !height) {
      return;
    }

    const containerAspect = rect.width / rect.height;

    // 根据容器实际比例，调整宽高以保持 16:9，无拉伸
    if (containerAspect > targetAspect) {
      // 容器较宽，按高度定，高度撑满，宽度收缩
      height = rect.height;
      width = rect.height * targetAspect;
    } else {
      // 容器较高，按宽度定，宽度撑满，高度收缩
      width = rect.width;
      height = rect.width / targetAspect;
    }

    // 创建 CanvasEditor 并指定挂载点、初始尺寸及背景色
    const editor = new CanvasEditor({
      container: containerRef.current,
      width,
      height,
      backgroundColor: useProjectStore.getState().canvasBackgroundColor,
    });

    editorRef.current = editor;

    /**
     * 处理容器尺寸变化：按当前画布比例重新计算尺寸
     * 同时覆盖窗口 resize 和面板拖拽等导致的容器大小变化
     */
    const handleResize = () => {
      if (!containerRef.current || !editorRef.current) return;

      const state = useProjectStore.getState();
      const aspect =
        state.project != null
          ? state.project.width / state.project.height
          : state.preferredCanvasSize.width / state.preferredCanvasSize.height;

      const r = containerRef.current.getBoundingClientRect();
      const targetAspect = aspect;
      let newWidth = r.width;
      let newHeight = r.height;

      if (!newWidth || !newHeight) {
        return;
      }

      const containerAspect = r.width / r.height;
      if (containerAspect > targetAspect) {
        newHeight = r.height;
        newWidth = r.height * targetAspect;
      } else {
        newWidth = r.width;
        newHeight = r.width / targetAspect;
      }

      editorRef.current.resize(newWidth, newHeight);
      bumpResizeTick();
    };

    // 使用 ResizeObserver 监听容器本身的尺寸变化（覆盖窗口 resize、面板拖拽、侧边栏展开等场景）
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // 清理函数：卸载/刷新时移除监听，销毁画布资源，取消任何 rAF 调度
    return () => {
      resizeObserver.disconnect();
      editor.getStage().destroy(); // 销毁 Konva Stage
      editorRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    // 仅首次挂载时运行/卸载时 cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意只在挂载时运行
  }, []);

  // 当画布比例变化时（用户选择新尺寸），重新计算并 resize
  useEffect(() => {
    const editor = editorRef.current;
    const container = containerRef.current;
    if (!editor || !container) return;

    const r = container.getBoundingClientRect();
    if (!r.width || !r.height) return;

    const containerAspect = r.width / r.height;
    let newWidth: number;
    let newHeight: number;

    if (containerAspect > canvasAspect) {
      newHeight = r.height;
      newWidth = r.height * canvasAspect;
    } else {
      newWidth = r.width;
      newHeight = r.width / canvasAspect;
    }

    editor.resize(newWidth, newHeight);
    bumpResizeTick();
  }, [canvasAspect, bumpResizeTick]);

  useEffect(() => {
    const unsub = useProjectStore.subscribe(
      (s) => s.canvasBackgroundColor,
      (color) => {
        editorRef.current?.setBackgroundColor(color);
      },
    );
    return unsub;
  }, []);

  // 交还 editorRef 和 resizeTick，供上层/子模块 hooks 使用
  return [editorRef, resizeTick];
}
