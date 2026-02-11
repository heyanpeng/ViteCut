import Konva from "konva";
import { createId } from "@swiftav/utils";
import type {
  CanvasEditorOptions,
  ImageOptions,
  ImageRenderElement,
  RenderElement,
  TextOptions,
  TextRenderElement,
  VideoOptions,
  VideoRenderElement,
} from "./types";

// 类型导出，便于外部直接使用类型定义
export type {
  BaseRenderElement,
  CanvasEditorOptions,
  ImageOptions,
  ImageRenderElement,
  RenderElement,
  RenderElementKind,
  TextOptions,
  TextRenderElement,
  VideoOptions,
  VideoRenderElement,
} from "./types";

// 默认字体参数
const DEFAULT_FONT_SIZE = 32;
const DEFAULT_FONT_FAMILY = "sans-serif";
const DEFAULT_FILL = "#ffffff";

/**
 * CanvasEditor
 * 画布编辑器类，封装对 Konva 的基础操作和元素管理能力
 */
export class CanvasEditor {
  // Konva 的主舞台对象
  private stage: Konva.Stage;
  // 背景层 (仅放置背景色矩形)
  private backgroundLayer: Konva.Layer;
  // 元素层 (所有文本/图片/视频等内容元素)
  private elementLayer: Konva.Layer;
  // 背景用矩形对象
  private bgRect: Konva.Rect;

  // 各类元素（文本/图片/视频）ID 到 Konva 节点的映射表
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
  // 已经同步到画布上的元素id集合（用于判定哪些需要清理）
  private syncedElementIds = new Set<string>();
  // 视频帧动画对象（若有正在播放的视频时，用于画布刷新）
  private videoAnimation: Konva.Animation | null = null;

  /**
   * 实例化画布编辑器
   * @param options 初始化参数，包括容器、尺寸、背景色等
   */
  constructor(options: CanvasEditorOptions) {
    const { container, width, height, backgroundColor = "#000000" } = options;

    // 创建主舞台和层，并挂载
    this.stage = new Konva.Stage({ container, width, height });
    this.backgroundLayer = new Konva.Layer();
    this.elementLayer = new Konva.Layer();
    this.stage.add(this.backgroundLayer);
    this.stage.add(this.elementLayer);

    // 背景填充用矩形
    this.bgRect = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: backgroundColor,
    });
    this.backgroundLayer.add(this.bgRect);
    this.backgroundLayer.draw();
  }

  /**
   * 获取 Konva 的舞台对象
   */
  getStage(): Konva.Stage {
    return this.stage;
  }

  /**
   * 设置画布背景色
   * @param color 新的背景颜色 (CSS字符串)
   */
  setBackgroundColor(color: string): void {
    this.bgRect.fill(color);
    this.backgroundLayer.batchDraw();
  }

  /**
   * 新增文本元素
   * @param options 文本元素的参数
   * @returns 新文本元素的 id
   */
  addText(options: TextOptions): string {
    const id = options.id ?? createId("text");
    const textNode = new Konva.Text({
      x: options.x ?? 0,
      y: options.y ?? 0,
      text: options.text,
      fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
      fontFamily: options.fontFamily ?? DEFAULT_FONT_FAMILY,
      fill: options.fill ?? DEFAULT_FILL,
      draggable: true,
    });
    this.elementLayer.add(textNode);
    this.elementLayer.draw();
    this.textMap.set(id, textNode);
    return id;
  }

  /**
   * 更新文本元素的属性
   * @param id 文本元素id
   * @param patch 需要更新的字段
   */
  updateText(id: string, patch: Partial<TextOptions>): void {
    const node = this.textMap.get(id);
    if (!node) {
      return;
    }
    if (patch.text !== undefined) {
      node.text(patch.text);
    }
    if (patch.x !== undefined) {
      node.x(patch.x);
    }
    if (patch.y !== undefined) {
      node.y(patch.y);
    }
    if (patch.fontSize !== undefined) {
      node.fontSize(patch.fontSize);
    }
    if (patch.fontFamily !== undefined) {
      node.fontFamily(patch.fontFamily);
    }
    if (patch.fill !== undefined) {
      node.fill(patch.fill);
    }
    this.elementLayer.batchDraw();
  }

  /**
   * 移除文本元素
   * @param id 文本元素id
   */
  removeText(id: string): void {
    const node = this.textMap.get(id);
    if (!node) {
      return;
    }
    node.destroy();
    this.textMap.delete(id);
    this.elementLayer.batchDraw();
  }

  /**
   * 新增图片元素
   * @param image HTMLImageElement 实例
   * @param options 图片位置及尺寸参数
   * @returns 新图片元素id
   */
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

  /**
   * 移除图片元素
   * @param id 图片元素id
   */
  removeImage(id: string): void {
    const node = this.imageMap.get(id);
    if (!node) {
      return;
    }
    node.destroy();
    this.imageMap.delete(id);
    this.elementLayer.batchDraw();
  }

  /**
   * 更新图片元素的坐标和尺寸
   * @param id 图片元素id
   * @param options 坐标或尺寸的属性
   */
  updateImage(
    id: string,
    options: { x?: number; y?: number; width?: number; height?: number },
  ): void {
    const node = this.imageMap.get(id);
    if (!node) {
      return;
    }
    if (options.x !== undefined) {
      node.x(options.x);
    }
    if (options.y !== undefined) {
      node.y(options.y);
    }
    if (options.width !== undefined) {
      node.width(options.width);
    }
    if (options.height !== undefined) {
      node.height(options.height);
    }
    this.elementLayer.batchDraw();
  }

  /**
   * 新增视频帧元素（video/frame必须为画布或ImageBitmap）
   * @param options 视频帧参数
   * @returns 新视频元素id
   */
  addVideo(options: VideoOptions): string {
    const { video, x = 0, y = 0, width, height } = options;
    const id = options.id ?? createId("video");
    const imageNode = new Konva.Image({
      image: video,
      x,
      y,
      width,
      height,
      draggable: true,
    });
    this.elementLayer.add(imageNode);
    this.elementLayer.draw();
    this.videoMap.set(id, { node: imageNode, source: video, playing: false });
    return id;
  }

  /**
   * 启动视频帧播放动画
   * @param id 视频元素id
   */
  playVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) {
      return;
    }
    item.playing = true;
    this.ensureVideoAnimation();
  }

  /**
   * 暂停视频帧播放动画
   * @param id 视频元素id
   */
  pauseVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) {
      return;
    }
    item.playing = false;
    this.maybeStopVideoAnimation();
  }

  /**
   * 移除视频帧元素
   * @param id 视频元素id
   */
  removeVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) {
      return;
    }
    item.node.destroy();
    this.videoMap.delete(id);
    this.elementLayer.batchDraw();
    this.maybeStopVideoAnimation();
  }

  /**
   * 将给定 elements 渲染结果批量同步到画布 (上层驱动)
   * @param elements 渲染元素数组（要求包含 id/ kind/ zIndex 等）
   */
  syncElements(elements: RenderElement[]): void {
    // 1. 先清理画布上不再存在的旧元素（元素id对比）
    const nextIds = new Set(elements.map((e) => e.id));
    this.removeStaleSyncedElements(nextIds);

    // 2. 按类型逐个同步到画布
    for (const el of elements) {
      switch (el.kind) {
        case "text":
          this.syncTextElement(el);
          break;
        case "image":
          this.syncImageElement(el);
          break;
        case "video":
          this.syncVideoElement(el);
          break;
      }
      this.syncedElementIds.add(el.id);
    }
    this.elementLayer.batchDraw();
  }

  /**
   * 使指定元素置于元素层最顶端
   * @param id 元素id
   */
  bringToFront(id: string): void {
    const node = this.getElementNodeById(id);
    if (!node) {
      return;
    }
    node.moveToTop();
    this.elementLayer.batchDraw();
  }

  /**
   * 使指定元素置于元素层最底端
   * @param id 元素id
   */
  sendToBack(id: string): void {
    const node = this.getElementNodeById(id);
    if (!node) {
      return;
    }
    node.moveToBottom();
    this.elementLayer.batchDraw();
  }

  /**
   * 设置元素的 zIndex（显示顺序）
   * @param id 元素id
   * @param zIndex 层级
   */
  setZIndex(id: string, zIndex: number): void {
    const node = this.getElementNodeById(id);
    if (!node) {
      return;
    }
    node.zIndex(zIndex);
    this.elementLayer.batchDraw();
  }

  /**
   * 按给定 id 列表设置元素层叠顺序（从底到顶）。
   * ids[0] 在最底，ids[ids.length-1] 在最顶；用于实现「上方轨道显示在下方轨道上面」。
   * @param ids 元素 id 数组，顺序为从底到顶
   */
  setElementOrder(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }
    // Konva 中后执行 moveToBottom 的会盖在先执行的上面，故倒序调用
    for (let i = ids.length - 1; i >= 0; i--) {
      const node = this.getElementNodeById(ids[i]);
      if (node) {
        node.moveToBottom();
      }
    }
    this.elementLayer.batchDraw();
  }

  /**
   * 调整画布和背景尺寸
   * @param width 新宽度
   * @param height 新高度
   */
  resize(width: number, height: number): void {
    this.stage.size({ width, height });
    this.backgroundLayer.getChildren().forEach((child) => {
      if (child instanceof Konva.Rect) {
        child.width(width);
        child.height(height);
      }
    });
    this.backgroundLayer.batchDraw();
  }

  /**
   * 根据 id 查找画布元素节点（包括文本、图片、视频）
   * @param id 元素id
   * @returns Konva 节点或 null
   */
  private getElementNodeById(id: string): Konva.Node | null {
    if (this.textMap.has(id)) {
      return this.textMap.get(id) ?? null;
    }
    if (this.imageMap.has(id)) {
      return this.imageMap.get(id) ?? null;
    }
    if (this.videoMap.has(id)) {
      return this.videoMap.get(id)!.node;
    }
    return null;
  }

  /**
   * 批量移除画布上已同步但不再存在的元素
   * @param nextIds 本轮应存在的元素id集合
   */
  private removeStaleSyncedElements(nextIds: Set<string>): void {
    this.syncedElementIds.forEach((id) => {
      if (nextIds.has(id)) {
        return;
      }
      if (this.textMap.has(id)) {
        this.removeText(id);
      } else if (this.imageMap.has(id)) {
        this.removeImage(id);
      } else if (this.videoMap.has(id)) {
        this.removeVideo(id);
      }
      this.syncedElementIds.delete(id);
    });
  }

  /**
   * 个别同步文本元素状态到 Konva
   * @param el 文本元素描述
   */
  private syncTextElement(el: TextRenderElement): void {
    const existing = this.textMap.get(el.id);
    if (!existing) {
      const textNode = new Konva.Text({
        x: el.x,
        y: el.y,
        text: el.text,
        fontSize: el.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: el.fontFamily ?? DEFAULT_FONT_FAMILY,
        fill: el.fill ?? DEFAULT_FILL,
        draggable: true,
        opacity: el.opacity,
        rotation: el.rotation,
      });
      this.elementLayer.add(textNode);
      textNode.zIndex(el.zIndex);
      this.textMap.set(el.id, textNode);
      return;
    }
    // 已存在则批量更新属性
    existing.x(el.x);
    existing.y(el.y);
    if (el.width !== undefined) {
      existing.width(el.width);
    }
    if (el.height !== undefined) {
      existing.height(el.height);
    }
    existing.text(el.text);
    if (el.fontSize !== undefined) {
      existing.fontSize(el.fontSize);
    }
    if (el.fontFamily !== undefined) {
      existing.fontFamily(el.fontFamily);
    }
    if (el.fill !== undefined) {
      existing.fill(el.fill);
    }
    if (el.opacity !== undefined) {
      existing.opacity(el.opacity);
    }
    if (el.rotation !== undefined) {
      existing.rotation(el.rotation);
    }
    existing.zIndex(el.zIndex);
  }

  /**
   * 个别同步图片元素状态到 Konva
   * @param el 图片元素描述
   */
  private syncImageElement(el: ImageRenderElement): void {
    const existing = this.imageMap.get(el.id);
    if (!existing) {
      const imageNode = new Konva.Image({
        image: el.image,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        draggable: true,
        opacity: el.opacity,
        rotation: el.rotation,
      });
      this.elementLayer.add(imageNode);
      imageNode.zIndex(el.zIndex);
      this.imageMap.set(el.id, imageNode);
      return;
    }
    // 已存在则更新
    existing.image(el.image);
    existing.x(el.x);
    existing.y(el.y);
    if (el.width !== undefined) {
      existing.width(el.width);
    }
    if (el.height !== undefined) {
      existing.height(el.height);
    }
    if (el.opacity !== undefined) {
      existing.opacity(el.opacity);
    }
    if (el.rotation !== undefined) {
      existing.rotation(el.rotation);
    }
    existing.zIndex(el.zIndex);
  }

  /**
   * 个别同步视频元素状态到 Konva
   * @param el 视频元素描述
   */
  private syncVideoElement(el: VideoRenderElement): void {
    const item = this.videoMap.get(el.id);
    if (!item) {
      // 不存在则先创建
      const id = this.addVideo({
        id: el.id,
        video: el.video,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
      });
      const node = this.videoMap.get(id)?.node;
      if (node) {
        if (el.opacity !== undefined) {
          node.opacity(el.opacity);
        }
        if (el.rotation !== undefined) {
          node.rotation(el.rotation);
        }
        node.zIndex(el.zIndex);
      }
      return;
    }
    // 已存在则更新
    const { node } = item;
    if (item.source !== el.video) {
      item.source = el.video;
      node.image(el.video);
    }
    node.x(el.x);
    node.y(el.y);
    if (el.width !== undefined) {
      node.width(el.width);
    }
    if (el.height !== undefined) {
      node.height(el.height);
    }
    if (el.opacity !== undefined) {
      node.opacity(el.opacity);
    }
    if (el.rotation !== undefined) {
      node.rotation(el.rotation);
    }
    node.zIndex(el.zIndex);
  }

  /**
   * 启动视频动画循环（全局唯一 Animation，只有至少有一帧在播放时开启）
   */
  private ensureVideoAnimation(): void {
    if (this.videoAnimation) {
      return;
    }
    this.videoAnimation = new Konva.Animation(() => {}, this.elementLayer);
    this.videoAnimation.start();
  }

  /**
   * 检查是否应该停止视频动画
   * 若所有视频帧都已暂停，则关闭动画
   */
  private maybeStopVideoAnimation(): void {
    const hasPlaying = Array.from(this.videoMap.values()).some(
      ({ playing }) => playing,
    );
    if (!hasPlaying && this.videoAnimation) {
      this.videoAnimation.stop();
      this.videoAnimation = null;
    }
  }
}
