import type { TrackId } from "./ids";
import type { Clip } from "./clip";

/**
 * 时间轴中的一条轨道。
 *
 * 轨道用于承载若干片段，并控制可见性、静音、锁定等。
 */
export interface Track {
  id: TrackId;
  /**
   * 轨道类型：决定该轨道主要承载的内容。
   * 具体约束由上层应用决定，这里仅作标记。
   */
  kind: "video" | "audio" | "mixed";
  /**
   * 轨道名称（如：主视频、背景音乐、字幕 1）。
   */
  name?: string;
  /**
   * 轨道在时间轴中的显示顺序，数值越大越靠上。
   */
  order: number;
  /**
   * 是否静音（仅对音频轨生效）。
   */
  muted?: boolean;
  /**
   * 是否在预览中隐藏该轨道（对视频/图像/文本轨生效）。
   */
  hidden?: boolean;
  /**
   * 是否锁定轨道（UI 层可禁止编辑）。
   */
  locked?: boolean;
  /**
   * 轨道中的片段列表。
   */
  clips: Clip[];
}
