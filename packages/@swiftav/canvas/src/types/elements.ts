/**
 * 画布编辑器相关类型定义
 * 本文件定义了画布编辑器(CanvasEditor)各类核心参数和渲染元素的数据结构。
 */

/**
 * CanvasEditor 的初始化配置选项
 */
export interface CanvasEditorOptions {
  /** 画布容器，可为 DOM 节点或其选择器字符串 */
  container: HTMLDivElement | string;
  /** 画布宽度（像素） */
  width: number;
  /** 画布高度（像素） */
  height: number;
  /** 画布背景色（可选，支持任何有效的 CSS 颜色字符串） */
  backgroundColor?: string;
}

/**
 * 创建文本元素时的参数
 */
export interface TextOptions {
  /** 元素 id（可选，不传则自动生成） */
  id?: string;
  /** 显示文本 */
  text: string;
  /** 文本 X 坐标（可选） */
  x?: number;
  /** 文本 Y 坐标（可选） */
  y?: number;
  /** 字号（像素，默认值见实现） */
  fontSize?: number;
  /** 字体名称（可选，默认见实现） */
  fontFamily?: string;
  /** 字体样式：normal | italic | bold | italic bold（Konva fontStyle） */
  fontStyle?: string;
  /** 文本装饰：line-through | underline | ""（Konva textDecoration） */
  textDecoration?: string;
  /** 字体颜色（CSS 颜色字符串，默认见实现） */
  fill?: string;
  /** 水平缩放（可选） */
  scaleX?: number;
  /** 垂直缩放（可选） */
  scaleY?: number;
  /** 旋转角度（度，可选） */
  rotation?: number;
}

/**
 * 创建图片元素时的参数
 */
export interface ImageOptions {
  /** 元素 id（可选，不传则自动生成） */
  id?: string;
  /** 图片左上角 X 坐标（可选） */
  x?: number;
  /** 图片左上角 Y 坐标（可选） */
  y?: number;
  /** 图片显示宽度（可选，像素） */
  width?: number;
  /** 图片显示高度（可选，像素） */
  height?: number;
}

/**
 * 视频帧源参数。
 * 上层可通过 WebCodecs 或 mediabunny 将解码后的视频帧绘制到 canvas 或转为 ImageBitmap，
 * 然后传入 CanvasEditor 渲染
 */
export interface VideoOptions {
  /** 元素 id（可选，不传则自动生成） */
  id?: string;
  /** 视频帧画布或解码后的 ImageBitmap */
  video: HTMLCanvasElement | ImageBitmap;
  /** 左上角 X 坐标（可选） */
  x?: number;
  /** 左上角 Y 坐标（可选） */
  y?: number;
  /** 显示宽度（可选，像素） */
  width?: number;
  /** 显示高度（可选，像素） */
  height?: number;
}

/**
 * 枚举：画布元素的类型
 * - 'text'：文本
 * - 'image'：图片
 * - 'video'：视频帧
 */
export type RenderElementKind = "text" | "image" | "video";

/**
 * 所有可渲染元素的基础属性
 */
export interface BaseRenderElement {
  /** 元素全局唯一 id */
  id: string;
  /** 元素类型，'text' | 'image' | 'video' 三选一 */
  kind: RenderElementKind;
  /** 元素层级，数值越大越靠上 */
  zIndex: number;
  /** 元素左上角 X 坐标 */
  x: number;
  /** 元素左上角 Y 坐标 */
  y: number;
  /** 元素宽度（像素，可选，某些类型可省略以自适应） */
  width?: number;
  /** 元素高度（像素，可选） */
  height?: number;
  /** 旋转角度（可选，单位：度） */
  rotation?: number;
  /** 元素透明度（0~1，可选） */
  opacity?: number;
}

/**
 * 文本渲染元素类型
 */
export interface TextRenderElement extends BaseRenderElement {
  /** 类型为 'text' */
  kind: "text";
  /** 显示文本内容 */
  text: string;
  /** 字号（像素，可选） */
  fontSize?: number;
  /** 字体名称（可选） */
  fontFamily?: string;
  /** 字体样式：normal | italic | bold | italic bold */
  fontStyle?: string;
  /** 文本装饰：line-through | underline | "" */
  textDecoration?: string;
  /** 字体颜色（可选，CSS 色值） */
  fill?: string;
}

/**
 * 图片渲染元素类型
 */
export interface ImageRenderElement extends BaseRenderElement {
  /** 类型为 'image' */
  kind: "image";
  /** 图片数据，可以是 <img>、canvas 或 ImageBitmap */
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap;
}

/**
 * 视频渲染元素类型
 */
export interface VideoRenderElement extends BaseRenderElement {
  /** 类型为 'video' */
  kind: "video";
  /** 视频帧，canvas 或解码后的 ImageBitmap */
  video: HTMLCanvasElement | ImageBitmap;
}

/**
 * 联合类型：所有可能的画布渲染元素
 */
export type RenderElement =
  | TextRenderElement
  | ImageRenderElement
  | VideoRenderElement;
