import type { AssetId } from "./ids";

/**
 * 媒体资源信息描述结构。
 *
 * 对应项目中的“素材”，可被多个 Clip 引用。
 */
export interface Asset {
  id: AssetId;
  /**
   * 资源名称，供 UI 展示使用。
   */
  name?: string;
  /**
   * 原始媒体路径或标识（URL、相对路径等）
   */
  source: string;
  kind: "video" | "audio" | "image" | "text";
  /**
   * 媒体本身的时长（秒），图片为 0 或 1 视业务而定。
   */
  duration?: number;
  /**
   * 视频资源的元信息（由 @vitecut/media 解析后写入）。
   */
  videoMeta?: {
    /**
     * 媒体文件的原始像素宽高（未旋转前）。
     */
    width: number;
    height: number;
    /**
     * 旋转角度（度），通常为 0 / 90 / 180 / 270。
     */
    rotation?: number;
    /**
     * 源媒体帧率（仅供参考，导出帧率由 Project.fps 决定）。
     */
    fps?: number;
    /**
     * 编码信息（如 H.264 / AV1 等）。
     */
    codec?: string;
  };
  /**
   * 音频资源的元信息。
   */
  audioMeta?: {
    /**
     * 采样率（Hz）。
     */
    sampleRate: number;
    /**
     * 声道数。
     */
    channels: number;
    /**
     * 编码信息（如 AAC / Opus 等）。
     */
    codec?: string;
  };
  /**
   * 图片资源的元信息。
   */
  imageMeta?: {
    width: number;
    height: number;
  };
  /**
   * 文本资源的元信息（例如模板文案），大部分文本仍建议直接存在 Clip 上。
   */
  textMeta?: {
    initialText?: string;
  };
  /**
   * 资源是否正在加载中（探测媒体信息 / 拉取远程文件等异步阶段）。
   * 为 true 时 timeline 上对应的 clip 应显示加载状态。
   */
  loading?: boolean;
}
