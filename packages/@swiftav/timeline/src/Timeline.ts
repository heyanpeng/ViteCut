/**
 * 时间轴管理
 */

export class Timeline {
  duration: number;
  currentTime: number;
  zoom: number;

  constructor(duration: number = 0) {
    this.duration = duration;
    this.currentTime = 0;
    this.zoom = 1;
  }

  /**
   * 跳转到指定时间
   */
  seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(time, this.duration));
  }

  /**
   * 设置时间轴缩放
   */
  setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(zoom, 10));
  }

  /**
   * 设置时长
   */
  setDuration(duration: number): void {
    this.duration = Math.max(0, duration);
    if (this.currentTime > this.duration) {
      this.currentTime = this.duration;
    }
  }

  /**
   * 将时间转换为像素位置
   */
  timeToPixels(time: number, pixelsPerSecond: number): number {
    return time * pixelsPerSecond * this.zoom;
  }

  /**
   * 将像素位置转换为时间
   */
  pixelsToTime(pixels: number, pixelsPerSecond: number): number {
    return pixels / (pixelsPerSecond * this.zoom);
  }
}

