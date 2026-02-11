import type { Project } from "@swiftav/project";

/**
 * ProjectStore：工程编辑器的核心全局状态（zustand）。
 *
 * 设计目标：
 * - **单一数据源**：`project` 承载工程的完整数据（资源池、轨道、片段、画布尺寸等）。
 * - **可预览驱动**：`currentTime/isPlaying/duration` 提供预览播放的最小状态集合。
 * - **UI 友好**：`loading/videoUrl/canvasBackgroundColor` 仅用于 UI/预览层逻辑，不应污染工程数据结构。
 *
 * 约定：
 * - 当 `project === null` 时表示尚未创建工程（未导入视频），多数操作应视为 no-op。
 * - `duration` 的来源是 `getProjectDuration(project)`，一般应在工程变化后同步更新。
 */
export interface ProjectStoreState {
  /**
   * 当前工程数据。
   *
   * - `null`：未创建工程（例如未导入视频）。
   * - 非 `null`：工程已创建，包含宽高、fps、assets/tracks 等信息。
   */
  project: Project | null;

  /**
   * 当前预览时间（秒）。
   *
   * - 用于驱动 Preview：在 `start <= currentTime < end` 区间的 clip 会被渲染。
   * - 由时间轴拖动、播放循环等逻辑更新。
   */
  currentTime: number;

  /**
   * 当前工程总时长（秒）。
   *
   * - 由工程内所有轨道 clip 的 end 最大值决定。
   * - 推荐在每次对工程做结构性修改（增删 clip/track）后重新计算并写回。
   */
  duration: number;

  /**
   * 是否正在播放（暂时仅用于 UI 与预览驱动）。
   *
   * - `true`：预览按 rAF/定时推进 currentTime。
   * - `false`：停留在 currentTime 对应画面。
   */
  isPlaying: boolean;

  /**
   * 是否正在执行导入/导出等耗时操作。
   *
   * - 用于 UI 置灰、loading 状态展示。
   */
  loading: boolean;

  /**
   * 当前主视频资源的 URL（通常由 File 生成的 blob URL）。
   *
   * - 用于预览播放或导出时读取视频帧。
   * - 当重新导入视频、或销毁工程时需要注意 revokeObjectURL（避免内存泄露）。
   */
  videoUrl: string | null;

  /**
   * 画布背景颜色（预览用）。
   *
   * - 仅用于预览画布的背景填充，不参与导出逻辑（若需导出背景色，应写入工程数据结构）。
   */
  canvasBackgroundColor: string;
}

/**
 * ProjectStore 的可调用动作集合。
 *
 * 说明：
 * - 这里定义的是“对外 API 形状”，具体实现位于 `projectStore.ts`。
 * - 若新增 action，建议同时补充其对 `project/duration/currentTime` 的影响说明。
 */
export interface ProjectStoreActions {
  /**
   * 从本地视频文件创建新工程或向现有工程追加视频。
   *
   * 典型行为：
   * - 若当前 `project === null`：创建新工程 + 主视频轨道 + 主视频 clip。
   * - 若当前已有工程：追加 asset + 追加轨道（在最上方）+ 追加 clip。
   *
   * 副作用：
   * - 会创建 blob URL，并更新 `videoUrl`。
   * - 会更新 `loading`、并重新计算 `duration`。
   */
  loadVideoFile(file: File): Promise<void>;

  /**
   * 更新当前预览时间（秒）。
   */
  setCurrentTime(time: number): void;

  /**
   * 更新播放状态。
   */
  setIsPlaying(isPlaying: boolean): void;

  /**
   * 设置画布背景颜色（预览用）。
   */
  setCanvasBackgroundColor(color: string): void;

  /**
   * 更新时间轴上某个 clip 的播放区间（start/end，单位：秒）。
   *
   * 用途：
   * - 当用户在 Timeline 上拖拽/移动 clip 时，需要把新的 start/end 写回工程数据，
   *   否则 Preview/导出仍会使用旧的时间区间。
   *
   * 说明：
   * - `trackId` 可选：若时间轴支持把 clip 拖到其它轨道（row），可一并更新归属轨道。
   */
  updateClipTiming(clipId: string, start: number, end: number, trackId?: string): void;

  /**
   * 将当前工程导出为 mp4，并返回生成的视频 Blob。
   *
   * - 返回 `null` 表示导出条件不满足（无工程/无资源/无主视频等）。
   * - `onProgress` 取值范围通常为 0~1（由底层 renderer 决定）。
   */
  exportToMp4(onProgress?: (progress: number) => void): Promise<Blob | null>;
}

/**
 * ProjectStore：state 与 actions 的组合类型。
 */
export type ProjectStore = ProjectStoreState & ProjectStoreActions;

