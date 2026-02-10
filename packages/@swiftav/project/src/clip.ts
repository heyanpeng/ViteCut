import type { AssetId, ClipId, ClipKind, TrackId } from './ids';

/**
 * 片段在画布上的变换信息。
 *
 * 用于描述位置、缩放、旋转、透明度等视觉属性。
 */
export interface ClipTransform {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
  anchorX?: number;
  anchorY?: number;
}

/**
 * 时间轴上的一个片段实例。
 *
 * 片段引用某个 Asset，并在时间轴与画布上有自己的时间与空间位置。
 */
export interface Clip {
  id: ClipId;
  trackId: TrackId;
  assetId: AssetId;
  kind: ClipKind;
  /**
   * 在时间轴上的起止时间（秒）
   */
  start: number;
  end: number;
  /**
   * 在源媒体中的入点 / 出点（秒），用于裁剪。
   */
  inPoint?: number;
  outPoint?: number;
  /**
   * 显式的变换/透明度信息，主要作用于画布渲染。
   */
  transform?: ClipTransform;
  /**
   * 额外参数（透明度、变换、特效 id 等）
   */
  params?: Record<string, unknown>;
}

/**
 * 用于更新 Clip 的可选字段集合。
 */
export interface UpdateClipPatch {
  trackId?: TrackId;
  start?: number;
  end?: number;
  inPoint?: number;
  outPoint?: number;
  transform?: ClipTransform;
  params?: Record<string, unknown>;
}

