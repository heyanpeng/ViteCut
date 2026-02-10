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
 * 基于 Konva.js 的画布编辑器
 *
 * - 管理舞台与基础图层
 * - 提供简单的文本与图片增删改接口
 */
export class CanvasEditor {
  private stage: Konva.Stage;
  private backgroundLayer: Konva.Layer;
  private contentLayer: Konva.Layer;
  private textLayer: Konva.Layer;

  private textMap = new Map<string, Konva.Text>();
  private imageMap = new Map<string, Konva.Image>();

  constructor(options: CanvasEditorOptions) {
    const { container, width, height, backgroundColor = '#000000' } = options;

    this.stage = new Konva.Stage({ container, width, height });

    this.backgroundLayer = new Konva.Layer();
    this.contentLayer = new Konva.Layer();
    this.textLayer = new Konva.Layer();

    this.stage.add(this.backgroundLayer);
    this.stage.add(this.contentLayer);
    this.stage.add(this.textLayer);

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

    this.textLayer.add(textNode);
    this.textLayer.draw();
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

    this.textLayer.batchDraw();
  }

  /**
   * 移除文本
   */
  removeText(id: string): void {
    const node = this.textMap.get(id);
    if (!node) return;

    node.destroy();
    this.textMap.delete(id);
    this.textLayer.batchDraw();
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

    this.contentLayer.add(imageNode);
    this.contentLayer.draw();
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
    this.contentLayer.batchDraw();
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

