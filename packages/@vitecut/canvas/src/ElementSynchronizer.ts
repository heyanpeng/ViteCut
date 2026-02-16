/**
 * ElementSynchronizer
 * ===================
 * 负责将渲染元素同步到 Konva 画布
 */

import Konva from "konva";
import { createId } from "@vitecut/utils";
import type {
  TextRenderElement,
  ImageRenderElement,
  VideoRenderElement,
  RenderElement,
} from "./types/elements";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FILL,
} from "./constants";
import type { SelectionManager } from "./SelectionManager";

export interface ElementMaps {
  textMap: Map<string, Konva.Text>;
  imageMap: Map<string, Konva.Image>;
  videoMap: Map<
    string,
    {
      node: Konva.Image;
      source: HTMLCanvasElement | ImageBitmap;
      playing: boolean;
    }
  >;
}

export interface ElementSynchronizerOptions {
  elementLayer: Konva.Layer;
  maps: ElementMaps;
  selectionManager: SelectionManager;
}

export class ElementSynchronizer {
  private elementLayer: Konva.Layer;
  private maps: ElementMaps;
  private selectionManager: SelectionManager;
  private syncedElementIds = new Set<string>();

  constructor(options: ElementSynchronizerOptions) {
    this.elementLayer = options.elementLayer;
    this.maps = options.maps;
    this.selectionManager = options.selectionManager;
  }

  /**
   * 同步元素列表
   */
  syncElements(elements: RenderElement[]): void {
    const nextIds = new Set(elements.map((e) => e.id));
    this.removeStaleElements(nextIds);

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
   * 清除已同步元素记录
   */
  clearSyncedIds(): void {
    this.syncedElementIds.clear();
  }

  /**
   * 获取已同步的元素 id 集合
   */
  getSyncedIds(): Set<string> {
    return this.syncedElementIds;
  }

  /**
   * 移除过期的元素
   */
  private removeStaleElements(nextIds: Set<string>): void {
    this.syncedElementIds.forEach((id) => {
      if (nextIds.has(id)) return;

      if (this.maps.textMap.has(id)) {
        this.removeText(id);
      } else if (this.maps.imageMap.has(id)) {
        this.removeImage(id);
      } else if (this.maps.videoMap.has(id)) {
        this.removeVideo(id);
      }

      this.syncedElementIds.delete(id);
    });
  }

  /**
   * 同步文本元素
   */
  private syncTextElement(el: TextRenderElement): void {
    const existing = this.maps.textMap.get(el.id);

    if (!existing) {
      const textNode = new Konva.Text({
        x: el.x,
        y: el.y,
        text: el.text,
        fontSize: el.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: el.fontFamily ?? DEFAULT_FONT_FAMILY,
        fontStyle: el.fontStyle ?? "normal",
        textDecoration: el.textDecoration ?? "",
        lineHeight: el.lineHeight ?? 1,
        letterSpacing: el.letterSpacing ?? 1,
        align: el.align ?? "left",
        fill: el.fill ?? DEFAULT_FILL,
        draggable: true,
        opacity: el.opacity,
        rotation: el.rotation,
      });

      this.selectionManager.bindSelectionEvents(textNode, el.id);
      this.elementLayer.add(textNode);
      textNode.zIndex(el.zIndex);
      this.maps.textMap.set(el.id, textNode);
      return;
    }

    // 更新现有元素
    existing.x(el.x);
    existing.y(el.y);
    if (el.width !== undefined) existing.width(el.width);
    if (el.height !== undefined) existing.height(el.height);
    existing.text(el.text);
    if (el.fontSize !== undefined) existing.fontSize(el.fontSize);
    if (el.fontFamily !== undefined) existing.fontFamily(el.fontFamily);
    if (el.fontStyle !== undefined) existing.fontStyle(el.fontStyle);
    if (el.textDecoration !== undefined)
      existing.textDecoration(el.textDecoration);
    if (el.lineHeight !== undefined) existing.lineHeight(el.lineHeight);
    if (el.letterSpacing !== undefined)
      existing.letterSpacing(el.letterSpacing);
    if (el.align !== undefined) existing.align(el.align);
    if (el.fill !== undefined) existing.fill(el.fill);
    if (el.opacity !== undefined) existing.opacity(el.opacity);
    if (el.rotation !== undefined) existing.rotation(el.rotation);
    existing.zIndex(el.zIndex);
  }

  /**
   * 同步图片元素
   */
  private syncImageElement(el: ImageRenderElement): void {
    const existing = this.maps.imageMap.get(el.id);

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

      this.selectionManager.bindSelectionEvents(imageNode, el.id);
      this.elementLayer.add(imageNode);
      imageNode.zIndex(el.zIndex);
      this.maps.imageMap.set(el.id, imageNode);
      return;
    }

    // 更新现有元素
    existing.image(el.image);
    existing.x(el.x);
    existing.y(el.y);
    if (el.width !== undefined) existing.width(el.width);
    if (el.height !== undefined) existing.height(el.height);
    if (el.opacity !== undefined) existing.opacity(el.opacity);
    if (el.rotation !== undefined) existing.rotation(el.rotation);
    existing.zIndex(el.zIndex);
  }

  /**
   * 同步视频元素
   */
  private syncVideoElement(el: VideoRenderElement): void {
    const item = this.maps.videoMap.get(el.id);

    if (!item) {
      const id = this.addVideo(el);
      const node = this.maps.videoMap.get(id)?.node;
      if (node) {
        if (el.opacity !== undefined) node.opacity(el.opacity);
        if (el.rotation !== undefined) node.rotation(el.rotation);
        node.zIndex(el.zIndex);
      }
      return;
    }

    // 更新现有元素
    const { node } = item;
    if (item.source !== el.video) {
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

  /**
   * 添加视频元素（内部使用）
   */
  private addVideo(el: VideoRenderElement): string {
    const { video, x = 0, y = 0, width, height } = el;
    const id = el.id ?? createId("video");

    const imageNode = new Konva.Image({
      image: video,
      x,
      y,
      width,
      height,
      draggable: true,
    });

    this.selectionManager.bindSelectionEvents(imageNode, id);
    this.elementLayer.add(imageNode);
    this.elementLayer.draw();

    this.maps.videoMap.set(id, {
      node: imageNode,
      source: video,
      playing: false,
    });

    return id;
  }

  /**
   * 移除文本元素
   */
  private removeText(id: string): void {
    const node = this.maps.textMap.get(id);
    if (!node) return;
    node.destroy();
    this.maps.textMap.delete(id);
    this.elementLayer.batchDraw();
  }

  /**
   * 移除图片元素
   */
  private removeImage(id: string): void {
    const node = this.maps.imageMap.get(id);
    if (!node) return;
    node.destroy();
    this.maps.imageMap.delete(id);
    this.elementLayer.batchDraw();
  }

  /**
   * 移除视频元素
   */
  private removeVideo(id: string): void {
    const item = this.maps.videoMap.get(id);
    if (!item) return;
    item.node.destroy();
    this.maps.videoMap.delete(id);
    this.elementLayer.batchDraw();
  }
}
