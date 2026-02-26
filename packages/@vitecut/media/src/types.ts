/**
 * 媒体基础信息（解码侧）- 视频轨道。
 */
export interface MediaTrackVideoInfo {
  displayWidth: number;
  displayHeight: number;
  rotation: number;
  /**
   * 视频编码格式，例如 H.264 (avc)、AV1 (av1) 等。
   * 具体字符串由 mediabunny 提供，这里用 string|null 兼容。
   */
  codec?: string | null;
}

/**
 * 媒体基础信息（解码侧）- 音频轨道。
 */
export interface MediaTrackAudioInfo {
  sampleRate: number;
  numberOfChannels: number;
  /**
   * 音频编码格式，例如 AAC / Opus 等。
   */
  codec?: string | null;
}

/**
 * 媒体整体信息（时长 + 主视频/音频轨道）。
 */
export interface MediaInfo {
  duration: number;
  video?: MediaTrackVideoInfo;
  audio?: MediaTrackAudioInfo;
}

/**
 * 统一的媒体源抽象，方便上层传入 URL 或本地文件。
 */
export type MediaSource =
  | { type: "url"; url: string }
  | { type: "blob"; blob: Blob };
