import Konva from "konva";
import { createId } from "@swiftav/utils";
import type {
  CanvasEditorOptions,
  ImageOptions,
  RenderElement,
  TextOptions,
  VideoOptions,
} from "./types/elements";

// 子模块导入
import { SelectionManager } from "./SelectionManager";
import { VideoAnimationManager } from "./VideoAnimationManager";
import { ElementSynchronizer } from "./ElementSynchronizer";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FILL,
} from "./constants";

/**
 * CanvasEditor
 * ============
 * 画布编辑器主类，封装对 Konva 的基础操作和元素管理能力。
 *
 * 架构设计：
 * - CanvasEditor: 主类，提供公共 API
 * - SelectionManager: 管理元素选中和编辑控件
 * - VideoAnimationManager: 管理视频播放动画
 * - ElementSynchronizer: 管理元素同步（渲染）
 */
export class CanvasEditor {
  // Konva 核心对象
  private stage: Konva.Stage;
  private backgroundLayer: Konva.Layer;
  private elementLayer: Konva.Layer;
  private bgRect: Konva.Rect;

  // 元素存储
  private textMap = new Map<string, Konva.Text>();
  private imageMap = new Map<string, Konva.Image>();
  private videoMap = new Map<
    string,
    {
      node: Konva.Image;
      source: HTMLCanvasElement | ImageBitmap;
      playing: boolean;
    }
  >();

  // 子模块
  private selectionManager: SelectionManager;
  private videoAnimationManager: VideoAnimationManager;
  private elementSynchronizer: ElementSynchronizer;

  /**
   * 实例化画布编辑器
   */
  constructor(options: CanvasEditorOptions) {
    const { container, width, height, backgroundColor = "#000000" } = options;

    // 创建舞台和层
    this.stage = new Konva.Stage({ container, width, height });
    this.backgroundLayer = new Konva.Layer();
    this.elementLayer = new Konva.Layer();
    this.stage.add(this.backgroundLayer);
    this.stage.add(this.elementLayer);

    // 背景
    this.bgRect = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: backgroundColor,
    });
    this.backgroundLayer.add(this.bgRect);
    this.backgroundLayer.draw();

    // 初始化子模块
    this.selectionManager = new SelectionManager({
      elementLayer: this.elementLayer,
      getElementNodeById: (id) => this.getElementNodeById(id),
      getNodeTypeById: (id) => this.getNodeTypeById(id),
    });

    this.videoAnimationManager = new VideoAnimationManager({
      elementLayer: this.elementLayer,
    });

    this.elementSynchronizer = new ElementSynchronizer({
      elementLayer: this.elementLayer,
      maps: {
        textMap: this.textMap,
        imageMap: this.imageMap,
        videoMap: this.videoMap,
      },
      selectionManager: this.selectionManager,
    });

    // 点击空白处取消选中
    this.stage.on("click tap", (e) => {
      if (e.target === this.stage || e.target === this.bgRect) {
        this.setSelectedElement(null);
      }
    });
  }

  // ====================
  // 基础方法
  // ====================

  getStage(): Konva.Stage {
    return this.stage;
  }

  /**
   * 获取元素在视口中的矩形区域（用于 Toolbar 等 UI 跟随定位）
   * @returns 视口坐标下的 { x, y, width, height }，元素不存在时返回 null
   */
  getElementRectInViewport(
    id: string,
  ): { x: number; y: number; width: number; height: number } | null {
    const node = this.getElementNodeById(id);
    if (!node) return null;

    const rect = node.getClientRect({ relativeTo: this.stage });
    // 使用 stage.content（实际绘制区域）而非 container，因为 container 可能被 flex 居中，导致坐标偏移
    const contentEl =
      (this.stage as { content?: HTMLElement }).content ??
      this.stage.container();
    const contentRect = contentEl.getBoundingClientRect();
    const scaleX = contentRect.width / this.stage.width();
    const scaleY = contentRect.height / this.stage.height();

    return {
      x: contentRect.left + rect.x * scaleX,
      y: contentRect.top + rect.y * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY,
    };
  }

  setBackgroundColor(color: string): void {
    this.bgRect.fill(color);
    this.backgroundLayer.batchDraw();
  }

  resize(width: number, height: number): void {
    this.stage.size({ width, height });
    this.bgRect.width(width);
    this.bgRect.height(height);
    this.backgroundLayer.batchDraw();
  }

  // ====================
  // 选中管理（代理到 SelectionManager）
  // ====================

  setCallbacks(
    callbacks: Parameters<SelectionManager["setCallbacks"]>[0],
  ): void {
    this.selectionManager.setCallbacks(callbacks);
  }

  setSelectedElement(id: string | null): void {
    this.selectionManager.setSelectedElement(id);
  }

  getSelectedTransform() {
    return this.selectionManager.getSelectedTransform();
  }

  // ====================
  // 元素管理（文本）
  // ====================

  addText(options: TextOptions): string {
    const id = options.id ?? createId("text");
    const textNode = new Konva.Text({
      x: options.x ?? 0,
      y: options.y ?? 0,
      offsetX: options.offsetX ?? 0,
      offsetY: options.offsetY ?? 0,
      text: options.text,
      fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
      fontFamily: options.fontFamily ?? DEFAULT_FONT_FAMILY,
      fontStyle: options.fontStyle ?? "normal",
      textDecoration: options.textDecoration ?? "",
      lineHeight: options.lineHeight ?? 1,
      letterSpacing: options.letterSpacing ?? 1,
      align: options.align ?? "left",
      fill: options.fill ?? DEFAULT_FILL,
      opacity: options.opacity ?? 1,
      scaleX: options.scaleX ?? 1,
      scaleY: options.scaleY ?? 1,
      rotation: options.rotation ?? 0,
      draggable: true,
    });

    this.selectionManager.bindSelectionEvents(textNode, id);
    this.elementLayer.add(textNode);
    this.elementLayer.draw();
    this.textMap.set(id, textNode);
    return id;
  }

  updateText(id: string, patch: Partial<TextOptions>): void {
    const node = this.textMap.get(id);
    if (!node) return;

    if (patch.text !== undefined) node.text(patch.text);
    if (patch.x !== undefined) node.x(patch.x);
    if (patch.y !== undefined) node.y(patch.y);
    if (patch.offsetX !== undefined) node.offsetX(patch.offsetX);
    if (patch.offsetY !== undefined) node.offsetY(patch.offsetY);
    if (patch.fontSize !== undefined) node.fontSize(patch.fontSize);
    if (patch.fontFamily !== undefined) node.fontFamily(patch.fontFamily);
    if (patch.fontStyle !== undefined) node.fontStyle(patch.fontStyle);
    if (patch.textDecoration !== undefined)
      node.textDecoration(patch.textDecoration);
    if (patch.lineHeight !== undefined) node.lineHeight(patch.lineHeight);
    if (patch.letterSpacing !== undefined)
      node.letterSpacing(patch.letterSpacing);
    if (patch.align !== undefined) node.align(patch.align);
    if (patch.fill !== undefined) node.fill(patch.fill);
    if (patch.opacity !== undefined) node.opacity(patch.opacity);
    if (patch.scaleX !== undefined) node.scaleX(patch.scaleX);
    if (patch.scaleY !== undefined) node.scaleY(patch.scaleY);
    if (patch.rotation !== undefined) node.rotation(patch.rotation);

    this.elementLayer.batchDraw();
  }

  removeText(id: string): void {
    const node = this.textMap.get(id);
    if (!node) return;
    node.destroy();
    this.textMap.delete(id);
    this.elementLayer.batchDraw();
  }

  // ====================
  // 元素管理（图片）
  // ====================

  addImage(image: HTMLImageElement, options: ImageOptions = {}): string {
    const id = options.id ?? createId("image");
    const imageNode = new Konva.Image({
      image,
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width,
      height: options.height,
      draggable: true,
    });

    this.elementLayer.add(imageNode);
    this.elementLayer.draw();
    this.imageMap.set(id, imageNode);
    return id;
  }

  updateImage(
    id: string,
    options: { x?: number; y?: number; width?: number; height?: number },
  ): void {
    const node = this.imageMap.get(id);
    if (!node) return;

    if (options.x !== undefined) node.x(options.x);
    if (options.y !== undefined) node.y(options.y);
    if (options.width !== undefined) node.width(options.width);
    if (options.height !== undefined) node.height(options.height);

    this.elementLayer.batchDraw();
  }

  removeImage(id: string): void {
    const node = this.imageMap.get(id);
    if (!node) return;
    node.destroy();
    this.imageMap.delete(id);
    this.elementLayer.batchDraw();
  }

  // ====================
  // 元素管理（视频）
  // ====================

  addVideo(options: VideoOptions): string {
    const {
      video,
      x = 0,
      y = 0,
      width = 0,
      height = 0,
      offsetX,
      offsetY,
      scaleX = 1,
      scaleY = 1,
      rotation = 0,
    } = options;
    const id = options.id ?? createId("video");

    const imageNode = new Konva.Image({
      image: video,
      x,
      y,
      width: Math.max(1, width),
      height: Math.max(1, height),
      offsetX,
      offsetY,
      scaleX,
      scaleY,
      rotation,
      draggable: true,
    });

    this.selectionManager.bindSelectionEvents(imageNode, id);
    this.elementLayer.add(imageNode);
    this.elementLayer.draw();

    this.videoMap.set(id, { node: imageNode, source: video, playing: false });
    return id;
  }

  playVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) return;
    item.playing = true;
    this.videoAnimationManager.ensureAnimation();
  }

  pauseVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) return;
    item.playing = false;
    this.videoAnimationManager.maybeStopAnimation(this.videoMap);
  }

  updateVideo(
    id: string,
    options: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      offsetX?: number;
      offsetY?: number;
      scaleX?: number;
      scaleY?: number;
      rotation?: number;
    },
  ): void {
    const item = this.videoMap.get(id);
    if (!item) return;

    if (options.x !== undefined) item.node.x(options.x);
    if (options.y !== undefined) item.node.y(options.y);
    if (options.width !== undefined) item.node.width(options.width);
    if (options.height !== undefined) item.node.height(options.height);
    if (options.offsetX !== undefined) item.node.offsetX(options.offsetX);
    if (options.offsetY !== undefined) item.node.offsetY(options.offsetY);
    if (options.scaleX !== undefined) item.node.scaleX(options.scaleX);
    if (options.scaleY !== undefined) item.node.scaleY(options.scaleY);
    if (options.rotation !== undefined) item.node.rotation(options.rotation);

    this.elementLayer.batchDraw();
  }

  removeVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) return;
    item.node.destroy();
    this.videoMap.delete(id);
    this.elementLayer.batchDraw();
    this.videoAnimationManager.maybeStopAnimation(this.videoMap);
  }

  // ====================
  // 元素同步（代理到 ElementSynchronizer）
  // ====================

  syncElements(elements: RenderElement[]): void {
    this.elementSynchronizer.syncElements(elements);
  }

  // ====================
  // 层级管理
  // ====================

  bringToFront(id: string): void {
    const node = this.getElementNodeById(id);
    if (!node) return;
    node.moveToTop();
    this.elementLayer.batchDraw();
  }

  sendToBack(id: string): void {
    const node = this.getElementNodeById(id);
    if (!node) return;
    node.moveToBottom();
    this.elementLayer.batchDraw();
  }

  setZIndex(id: string, zIndex: number): void {
    const node = this.getElementNodeById(id);
    if (!node) return;
    node.zIndex(zIndex);
    this.elementLayer.batchDraw();
  }

  setElementOrder(ids: string[]): void {
    if (ids.length === 0) return;

    // 倒序调用 moveToBottom，后执行的会盖在先执行的上面
    for (let i = ids.length - 1; i >= 0; i--) {
      const node = this.getElementNodeById(ids[i]);
      if (node) node.moveToBottom();
    }

    this.elementLayer.batchDraw();
  }

  // ====================
  // 私有工具方法
  // ====================

  private getElementNodeById(id: string): Konva.Node | null {
    return (
      this.textMap.get(id) ??
      this.imageMap.get(id) ??
      this.videoMap.get(id)?.node ??
      null
    );
  }

  private getNodeTypeById(id: string): "text" | "image" | "video" | null {
    if (this.textMap.has(id)) return "text";
    if (this.imageMap.has(id)) return "image";
    if (this.videoMap.has(id)) return "video";
    return null;
  }

  // ====================
  // 销毁
  // ====================

  destroy(): void {
    this.selectionManager.destroy();
    this.videoAnimationManager.destroy();
    this.stage.destroy();
  }
}
