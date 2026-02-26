/**
 * VideoAnimationManager
 * =====================
 * 管理视频元素的播放动画
 */

import Konva from "konva";
import type { VideoItem } from "./types/editor";

export interface VideoAnimationManagerOptions {
  elementLayer: Konva.Layer;
}

export class VideoAnimationManager {
  private elementLayer: Konva.Layer;
  private videoAnimation: Konva.Animation | null = null;

  constructor(options: VideoAnimationManagerOptions) {
    this.elementLayer = options.elementLayer;
  }

  /**
   * 启动视频动画循环
   */
  ensureAnimation(): void {
    if (this.videoAnimation) {
      return;
    }
    this.videoAnimation = new Konva.Animation(() => {}, this.elementLayer);
    this.videoAnimation.start();
  }

  /**
   * 检查是否应该停止视频动画
   */
  maybeStopAnimation(videoMap: Map<string, VideoItem>): void {
    const hasPlaying = Array.from(videoMap.values()).some(
      ({ playing }) => playing
    );
    if (!hasPlaying && this.videoAnimation) {
      this.videoAnimation.stop();
      this.videoAnimation = null;
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.videoAnimation) {
      this.videoAnimation.stop();
      this.videoAnimation = null;
    }
  }
}
