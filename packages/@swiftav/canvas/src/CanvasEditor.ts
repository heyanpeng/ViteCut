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

export interface VideoOptions {
  id?: string;
  /**
   * 由上层传入已创建好的 HTMLVideoElement，
   * 上层可以自行配置 src / preload / crossOrigin / muted / loop 等属性。
   */
  video: HTMLVideoElement;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

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
      video: HTMLVideoElement;
    }
  >();

  /**
   * 当存在至少一个正在播放的视频时，启动该动画以持续重绘元素层。
   */
  private videoAnimation: Konva.Animation | null = null;

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
  }

  getStage(): Konva.Stage {
    return this.stage;
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
   * 使用方式参考 Konva 官方示例：
   * https://konvajs.org/docs/sandbox/Video_On_Canvas.html
   *
   * - 上层负责创建并配置 HTMLVideoElement（src / preload / crossOrigin / muted 等）
   * - CanvasEditor 负责将其挂载到 Konva.Image，并在播放时驱动重绘
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

    // 当视频元信息加载完成后，如果未显式指定宽高，则使用视频自身尺寸
    const handleLoadedMetadata = () => {
      if (imageNode.width() === 0 || imageNode.height() === 0) {
        imageNode.width(video.videoWidth);
        imageNode.height(video.videoHeight);
        this.elementLayer.batchDraw();
      }
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    this.elementLayer.add(imageNode);
    this.elementLayer.draw();

    this.videoMap.set(id, { node: imageNode, video });
    return id;
  }

  /**
   * 播放指定视频
   */
  playVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) return;

    void item.video.play();
    this.ensureVideoAnimation();
  }

  /**
   * 暂停指定视频
   */
  pauseVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) return;

    item.video.pause();
    this.maybeStopVideoAnimation();
  }

  /**
   * 移除视频元素
   */
  removeVideo(id: string): void {
    const item = this.videoMap.get(id);
    if (!item) return;

    item.node.destroy();
    item.video.pause();
    this.videoMap.delete(id);
    this.elementLayer.batchDraw();
    this.maybeStopVideoAnimation();
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
      ({ video }) => !video.paused && !video.ended,
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

