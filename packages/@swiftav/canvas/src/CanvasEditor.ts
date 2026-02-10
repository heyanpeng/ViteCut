import Konva from 'konva';

export interface CanvasEditorOptions {
  container: HTMLDivElement | string;
  width: number;
  height: number;
  backgroundColor?: string;
}

export interface TextOptions {
  id?: string;
  text: string;
  x?: number;
  y?: number;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
}

export interface ImageOptions {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * 视频帧源。
 *
 * 这里不再直接依赖 HTMLVideoElement，而是期望上层通过 WebCodecs /
 * mediabunny（参考官方示例 `Media player example`：`https://mediabunny.dev/examples/media-player/`）
 * 将解码后的帧绘制到一个专用的 canvas 或转成 ImageBitmap，再交由 CanvasEditor 负责呈现。
 */
export interface VideoOptions {
  id?: string;
  /**
   * 用于承载当前视频帧的像素数据：
   * - 典型场景是一个由 WebCodecs 解码管线持续绘制的 HTMLCanvasElement；
   * - 也可以是某一帧的静态 ImageBitmap。
   */
  video: HTMLCanvasElement | ImageBitmap;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export type RenderElementKind = 'text' | 'image' | 'video';

export interface BaseRenderElement {
  id: string;
  kind: RenderElementKind;
  /**
   * 元素在画面中的全局排序值。
   * 轨道、轨道内顺序等信息应由上层计算后折叠到该字段。
   */
  zIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
}

export interface TextRenderElement extends BaseRenderElement {
  kind: 'text';
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
}

export interface ImageRenderElement extends BaseRenderElement {
  kind: 'image';
  /**
   * 预览阶段通常是 HTMLImageElement，
   * 也可以是 HTMLCanvasElement 或 ImageBitmap。
   */
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap;
}

export interface VideoRenderElement extends BaseRenderElement {
  kind: 'video';
  /**
   * 预览阶段使用由 WebCodecs / mediabunny 解码出来并绘制的 canvas 或 ImageBitmap。
   * 导出阶段可以通过其他通道传入解码后的帧。
   */
  video: HTMLCanvasElement | ImageBitmap;
}

export type RenderElement = TextRenderElement | ImageRenderElement | VideoRenderElement;

/**
 * 基于 Konva.js 的画布编辑器
 *
 * - 管理舞台与基础图层
 * - 提供简单的文本 / 图片 / 视频元素增删改接口
 */
export class CanvasEditor {
  private stage: Konva.Stage;
  /**
   * 底层背景层，只负责绘制背景色 / 背景图，不参与交互与频繁重绘。
   */
  private backgroundLayer: Konva.Layer;
  /**
   * 元素层：所有非背景元素（文本 / 图片 / 视频等）统一放在该层，
   * 通过 node.zIndex() 控制前后顺序。
   *
   * 轨道（timeline track）的概念不在 Canvas 层体现，
   * 由上层 @swiftav/timeline 负责计算好 zIndex 后再传入。
   */
  private elementLayer: Konva.Layer;

  private textMap = new Map<string, Konva.Text>();
  private imageMap = new Map<string, Konva.Image>();
  private videoMap = new Map<
    string,
    {
      node: Konva.Image;
      source: HTMLCanvasElement | ImageBitmap;
      /**
       * 仅用于控制是否需要启动 Konva.Animation 重绘循环，
       * 解码与逐帧绘制由上层（例如基于 mediabunny 的 WebCodecs 播放器）负责。
       */
      playing: boolean;
    }
  >();

  /**
   * 由 syncElements 管理的元素 id 集合。
   * 仅用于 diff 计算，不影响手动调用 addText/addImage/addVideo 的场景。
   */
  private syncedElementIds = new Set<string>();

  /**
   * 当存在至少一个正在播放的视频时，启动该动画以持续重绘元素层。
   */
  private videoAnimation: Konva.Animation | null = null;

  private bgRect: Konva.Rect;

  constructor(options: CanvasEditorOptions) {
    const { container, width, height, backgroundColor = '#000000' } = options;

    this.stage = new Konva.Stage({ container, width, height });

    this.backgroundLayer = new Konva.Layer();
    this.elementLayer = new Konva.Layer();

    this.stage.add(this.backgroundLayer);
    this.stage.add(this.elementLayer);

    const bgRect = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: backgroundColor,
    });
    this.backgroundLayer.add(bgRect);
    this.backgroundLayer.draw();
    this.bgRect = bgRect;
  }

  getStage(): Konva.Stage {
    return this.stage;
  }

  /**
   * 更新画布背景颜色
   */
  setBackgroundColor(color: string): void {
    this.bgRect.fill(color);
    this.backgroundLayer.batchDraw();
  }

  /**
   * 添加文本
   */
  addText(options: TextOptions): string {
    const id = options.id ?? `text-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const textNode = new Konva.Text({
      x: options.x ?? 0,
      y: options.y ?? 0,
      text: options.text,
      fontSize: options.fontSize ?? 32,
      fontFamily: options.fontFamily ?? 'sans-serif',
      fill: options.fill ?? '#ffffff',
      draggable: true,
    });

    this.elementLayer.add(textNode);
    this.elementLayer.draw();
    this.textMap.set(id, textNode);

    return id;
  }

  /**
   * 更新文本属性
   */
  updateText(id: string, patch: Partial<TextOptions>): void {
    const node = this.textMap.get(id);
    if (!node) return;

    if (patch.text !== undefined) node.text(patch.text);
    if (patch.x !== undefined) node.x(patch.x);
    if (patch.y !== undefined) node.y(patch.y);
    if (patch.fontSize !== undefined) node.fontSize(patch.fontSize);
    if (patch.fontFamily !== undefined) node.fontFamily(patch.fontFamily);
    if (patch.fill !== undefined) node.fill(patch.fill);

    this.elementLayer.batchDraw();
  }

  /**
   * 移除文本
   */
  removeText(id: string): void {
    const node = this.textMap.get(id);
    if (!node) return;

    node.destroy();
    this.textMap.delete(id);
    this.elementLayer.batchDraw();
  }

  /**
   * 添加图片（通过 HTMLImageElement）
   */
  addImage(image: HTMLImageElement, options: ImageOptions = {}): string {
    const id = options.id ?? `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
   * 移除图片
   */
  removeImage(id: string): void {
    const node = this.imageMap.get(id);
    if (!node) return;

    node.destroy();
    this.imageMap.delete(id);
    this.elementLayer.batchDraw();
  }

  /**
   * 添加视频元素
   *
   * - 上层负责通过 WebCodecs / mediabunny 解码并将当前帧绘制到 canvas 或生成 ImageBitmap；
   * - CanvasEditor 只负责把该帧源挂载到 Konva.Image，并在「播放中」时驱动图层重绘。
   */
  addVideo(options: VideoOptions): string {
    const { video, x = 0, y = 0, width, height } = options;
    const id = options.id ?? `video-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
   * 播放指定视频
   */
  playVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) return;

    item.playing = true;
    this.ensureVideoAnimation();
  }

  /**
   * 暂停指定视频
   */
  pauseVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) return;

    item.playing = false;
    this.maybeStopVideoAnimation();
  }

  /**
   * 移除视频元素
   */
  removeVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) return;

    item.node.destroy();
    this.videoMap.delete(id);
    this.elementLayer.batchDraw();
    this.maybeStopVideoAnimation();
  }

  /**
   * 将当前时间点的渲染元素整体同步到画布。
   *
   * 上层（例如 @swiftav/timeline）应根据 currentTime 计算好 elements 和 zIndex，
   * CanvasEditor 只负责根据这些元素创建 / 更新 / 删除 Konva 节点。
   *
   * 注意：
   * - 该方法会管理自身创建的元素（syncedElementIds），不存在于下次调用中的元素会被移除。
   * - 不会影响通过 addText/addImage/addVideo 手动添加的元素，除非它们的 id 也出现在 elements 中。
   */
  syncElements(elements: RenderElement[]): void {
    const nextIds = new Set(elements.map((e) => e.id));

    // 1. 移除不再存在的已同步元素
    this.syncedElementIds.forEach((id) => {
      if (!nextIds.has(id)) {
        if (this.textMap.has(id)) {
          this.removeText(id);
        } else if (this.imageMap.has(id)) {
          this.removeImage(id);
        } else if (this.videoMap.has(id)) {
          this.removeVideo(id);
        }
        this.syncedElementIds.delete(id);
      }
    });

    // 2. 新增或更新当前元素
    for (const el of elements) {
      switch (el.kind) {
        case 'text': {
          const existing = this.textMap.get(el.id);
          if (!existing) {
            const id =
              el.id ??
              `text-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const textNode = new Konva.Text({
              x: el.x,
              y: el.y,
              text: el.text,
              fontSize: el.fontSize ?? 32,
              fontFamily: el.fontFamily ?? 'sans-serif',
              fill: el.fill ?? '#ffffff',
              draggable: true,
              opacity: el.opacity,
              rotation: el.rotation,
            });
            this.elementLayer.add(textNode);
            textNode.zIndex(el.zIndex);
            this.textMap.set(id, textNode);
          } else {
            existing.x(el.x);
            existing.y(el.y);
            if (el.width !== undefined) existing.width(el.width);
            if (el.height !== undefined) existing.height(el.height);
            existing.text(el.text);
            if (el.fontSize !== undefined) existing.fontSize(el.fontSize);
            if (el.fontFamily !== undefined) existing.fontFamily(el.fontFamily);
            if (el.fill !== undefined) existing.fill(el.fill);
            if (el.opacity !== undefined) existing.opacity(el.opacity);
            if (el.rotation !== undefined) existing.rotation(el.rotation);
            existing.zIndex(el.zIndex);
          }
          this.syncedElementIds.add(el.id);
          break;
        }
        case 'image': {
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
          } else {
            existing.image(el.image);
            existing.x(el.x);
            existing.y(el.y);
            if (el.width !== undefined) existing.width(el.width);
            if (el.height !== undefined) existing.height(el.height);
            if (el.opacity !== undefined) existing.opacity(el.opacity);
            if (el.rotation !== undefined) existing.rotation(el.rotation);
            existing.zIndex(el.zIndex);
          }
          this.syncedElementIds.add(el.id);
          break;
        }
        case 'video': {
          const item = this.videoMap.get(el.id);
          if (!item) {
            const id = this.addVideo({
              id: el.id,
              video: el.video,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
            });
            // addVideo 已经写入 videoMap
            const node = this.videoMap.get(id)?.node;
            if (node) {
              if (el.opacity !== undefined) node.opacity(el.opacity);
              if (el.rotation !== undefined) node.rotation(el.rotation);
              node.zIndex(el.zIndex);
            }
          } else {
            const { node } = item;
            if (item.source !== el.video) {
              // 如果上层替换了帧源，更新 image 源
              item.source = el.video;
              node.image(el.video);
            }
            node.x(el.x);
            node.y(el.y);
            if (el.width !== undefined) node.width(el.width);
            if (el.height !== undefined) node.height(el.height);
            if (el.opacity !== undefined) node.opacity(el.opacity);
            if (el.rotation !== undefined) node.rotation(el.rotation);
            node.zIndex(el.zIndex);
          }
          this.syncedElementIds.add(el.id);
          break;
        }
      }
    }

    this.elementLayer.batchDraw();
  }

  /**
   * 将元素（文本 / 图片 / 视频）移到最上方
   */
  bringToFront(id: string): void {
    const node = this.getElementNodeById(id);
    if (!node) return;
    node.moveToTop();
    this.elementLayer.batchDraw();
  }

  /**
   * 将元素移到最下方（但仍在背景层之上）
   */
  sendToBack(id: string): void {
    const node = this.getElementNodeById(id);
    if (!node) return;
    node.moveToBottom();
    this.elementLayer.batchDraw();
  }

  /**
   * 设置元素在元素层内的 zIndex。
   * 注意：0 仍然位于背景层之上。
   */
  setZIndex(id: string, zIndex: number): void {
    const node = this.getElementNodeById(id);
    if (!node) return;
    node.zIndex(zIndex);
    this.elementLayer.batchDraw();
  }

  /**
   * 根据 id 在各自的 Map 中查找元素对应的 Konva 节点。
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

  private ensureVideoAnimation(): void {
    if (this.videoAnimation) return;

    this.videoAnimation = new Konva.Animation(() => {
      // 空回调即可，Konva 会在每一帧重绘 elementLayer
    }, this.elementLayer);

    this.videoAnimation.start();
  }

  private maybeStopVideoAnimation(): void {
    // 如果已经没有正在播放的视频，则停止动画
    const hasPlaying = Array.from(this.videoMap.values()).some(
      ({ playing }) => playing,
    );

    if (!hasPlaying && this.videoAnimation) {
      this.videoAnimation.stop();
      this.videoAnimation = null;
    }
  }

  /**
   * 调整画布尺寸
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
}

