import type { ProjectId } from "./ids";
import type { Asset } from "./asset";
import type { Clip } from "./clip";
import type { Track } from "./track";
import type { ProjectExportSettings } from "./project";

/**
 * 为导出/后端渲染准备的精简资源结构。
 *
 * - 去掉纯 UI 字段（如 name/loading）
 * - 仅保留渲染所需的元信息与源地址
 */
export interface RenderAsset {
  id: Asset["id"];
  source: Asset["source"];
  kind: Asset["kind"];
  duration?: Asset["duration"];
  videoMeta?: Asset["videoMeta"];
  audioMeta?: Asset["audioMeta"];
  imageMeta?: Asset["imageMeta"];
  textMeta?: Asset["textMeta"];
}

/**
 * 为导出/后端渲染准备的精简片段结构。
 *
 * 保留时间轴区间、素材引用、裁剪点与画布变换等信息。
 */
export interface RenderClip {
  id: Clip["id"];
  trackId: Clip["trackId"];
  assetId: Clip["assetId"];
  kind: Clip["kind"];
  start: Clip["start"];
  end: Clip["end"];
  inPoint?: Clip["inPoint"];
  outPoint?: Clip["outPoint"];
  transform?: Clip["transform"];
  params?: Clip["params"];
}

/**
 * 为导出/后端渲染准备的精简轨道结构。
 *
 * 仅保留轨道类型、顺序、可见性与包含的片段。
 */
export interface RenderTrack {
  id: Track["id"];
  kind: Track["kind"];
  name?: Track["name"];
  order: Track["order"];
  muted?: Track["muted"];
  hidden?: Track["hidden"];
  clips: RenderClip[];
}

/**
 * 导出/后端渲染使用的工程快照。
 *
 * - 在 Project 基础上增加 duration 字段（便于后端快速获知总时长）
 * - 精简 assets/tracks/clips，仅保留渲染相关信息
 */
export interface RenderProject {
  id: ProjectId;
  name: string;
  version: 1;
  fps: number;
  width: number;
  height: number;
  /**
   * 工程总时长（秒），等价于 getProjectDuration(Project)。
   */
  duration: number;
  exportSettings?: ProjectExportSettings;
  createdAt?: string;
  updatedAt?: string;
  assets: RenderAsset[];
  tracks: RenderTrack[];
}

