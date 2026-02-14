/**
 * 预览组件 Preview
 * ====================
 * 该组件负责渲染工程中的多轨道内容到画布上（视频、文本、图片），并根据全局的当前播放时间和播放状态，自动同步画面。
 *
 * 实现说明：
 * - 视频轨道：每个视频 asset 通过一个 CanvasSink 渲染。根据 currentTime 计算哪些视频片段在当前帧“可见”，每个 active 片段会用 addVideo 生成一个 canvas 节点加入画布中。播放状态下通过 rAF 驱动帧前进和渲染；暂停/seek 时调用 getCanvas 拉取目标时间点的静止帧。
 * - 文本轨道：仅在 start <= currentTime < end 区间的文本片段会被 add/update 到画布上，否则就 remove。同步通过 usePreviewTextSync 实现，支持动态内容/位置变化。
 * - 图片轨道：逻辑类似文本，根据 currentTime 决定哪些图片片段可见且应显示。底层对 asset 做了缓存，以减少不必要的网络加载和对象创建，由 usePreviewImageSync 管理。
 *
 * 生命周期 & 状态说明：
 * - 挂载时，创建 canvas 画布，绑定到页面上的可视区域，限制并自适应 16:9 比例。
 * - 监听窗口 resize，实时调整画布尺寸并同步到 CanvasEditor。
 * - 接受全局的 project、currentTime 状态，并据此驱动三类轨道内容同步。
 * - 卸载时自动清理画布与各类副作用。
 *
 * hooks 用法说明：
 * - usePreviewCanvas：负责初始化并持有 canvas 编辑器实例，以及负责宽高调整与资源释放。
 * - usePreviewTextSync：同步当前帧的可见文本剪辑（add/update/remove）。
 * - usePreviewImageSync：同步当前帧的可见图片剪辑（add/update/remove），含缓存处理。
 * - usePreviewVideo：驱动视频播放/渲染流程，封装 rAF 管理与帧消费逻辑。
 * - usePreviewElementOrder：按轨道 order 设置元素叠放顺序，保证上方轨道在上层。
 *
 * 样式说明：
 * - 顶层容器 div.className="preview-container"，样式详见同目录 Preview.css
 */
import { useRef } from "react";
import { findClipById } from "@swiftav/project";
import { useProjectStore } from "@/stores";
import { usePreviewCanvas } from "./usePreviewCanvas";
import { usePreviewElementOrder } from "./usePreviewElementOrder";
import { usePreviewImageSync } from "./usePreviewImageSync";
import { usePreviewTextSync } from "./usePreviewTextSync";
import { usePreviewVideo } from "./usePreviewVideo";
import { usePreviewSelection } from "./usePreviewSelection";
import { useSelectionToolbarPosition } from "./useSelectionToolbarPosition";
import { SelectionToolbar } from "./SelectionToolbar";
import "./Preview.css";

/**
 * 预览组件 Preview
 * @returns 预览组件
 */
export function Preview() {
  // 预览整体容器（Toolbar 定位基准）
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  // 画布容器 dom 节点引用，传给 CanvasEditor 做挂载
  const containerRef = useRef<HTMLDivElement | null>(null);

  // rafIdRef: 用于管理播放时 requestAnimationFrame 的 id，便于暂停/重置时取消 rAF
  const rafIdRef = useRef<number | null>(null);

  // editorRef: 画布编辑器实例的 ref，由 usePreviewCanvas hook 初始化和托管
  const editorRef = usePreviewCanvas(containerRef, rafIdRef);

  // 从全局 store 获取当前工程 project 数据和当前时间戳（秒）
  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.currentTime);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const selectedClipId = useProjectStore((s) => s.selectedClipId);

  // 同步当前帧所有可见文本片段进画布，自动处理增删改；播放时按 clip 时间显示/隐藏
  usePreviewTextSync(editorRef, project, currentTime, isPlaying);

  // 同步当前帧所有可见图片片段进画布，带缓存和异步加载；播放时按 clip 时间显示/隐藏
  usePreviewImageSync(editorRef, project, currentTime, isPlaying);

  // 挂载并驱动所有视频同步和播放调度（音频经 AudioBufferSink + Web Audio API 排程，与 media-player 一致）
  usePreviewVideo(editorRef, rafIdRef);

  // 按轨道 order 设置元素叠放顺序，保证「上方轨道」显示在「下方轨道」上面
  usePreviewElementOrder(editorRef, project, currentTime, isPlaying);

  // 选中编辑功能（播放时禁用）
  usePreviewSelection(editorRef, { disabled: isPlaying });

  // 判断当前选中 clip 在时间范围内是否可见，用于 Toolbar 显示
  const selectedClip =
    selectedClipId && project ? findClipById(project, selectedClipId) : null;
  const isClipVisible =
    selectedClip != null &&
    currentTime >= selectedClip.start &&
    currentTime < selectedClip.end;
  const toolbarVisible = !!selectedClipId && isClipVisible;
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  // Toolbar 跟随选中元素定位（直接 DOM 更新，与 Konva 同帧）
  const toolbarPosition = useSelectionToolbarPosition(
    editorRef,
    previewContainerRef,
    toolbarRef,
    selectedClipId,
    toolbarVisible,
  );

  return (
    <div
      className="preview-container preview-container--with-toolbar"
      ref={previewContainerRef}
    >
      <SelectionToolbar
        ref={toolbarRef}
        visible={toolbarVisible}
        clipKind={selectedClip?.kind}
        position={toolbarPosition}
      />
      <div className="preview-container__canvas-area" ref={containerRef} />
    </div>
  );
}
