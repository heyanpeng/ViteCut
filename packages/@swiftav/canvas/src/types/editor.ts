/**
 * CanvasEditor 扩展类型定义
 * ========================
 * 包含选中编辑相关的类型定义
 */

/**
 * 元素变换事件回调
 */
export interface TransformEvent {
  id: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  width?: number;
  height?: number;
}

/**
 * CanvasEditor 配置选项扩展
 */
export interface CanvasEditorCallbacks {
  /** 元素被选中时触发 */
  onElementSelect?: (id: string | null) => void;
  /** 元素变换（移动、缩放、旋转）过程中触发 */
  onElementTransform?: (event: TransformEvent) => void;
  /** 元素变换结束时触发（用于提交历史记录） */
  onElementTransformEnd?: (event: TransformEvent) => void;
}

/**
 * 视频元素项（内部使用）
 */
export interface VideoItem {
  node: import("konva").default.Image;
  source: HTMLCanvasElement | ImageBitmap;
  playing: boolean;
}

/**
 * 元素类型
 */
export type ElementType = "text" | "image" | "video";
