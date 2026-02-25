import type { Project } from "@vitecut/project";
import type { Command } from "@vitecut/history";

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

  /**
   * 偏好画布尺寸（无工程时用户选择的宽高）。
   * - 导入视频创建工程时优先使用此尺寸；
   * - 有工程时由 project.width/height 决定，与此保持一致。
   */
  preferredCanvasSize: { width: number; height: number };

  /**
   * 用户显式选中的画布预设 value（如 "wechat-video-16:9"）。
   * 比例相同时（如抖音横屏 16:9 与视频号 16:9）用于区分并正确显示选中项。
   * null 时由 preferredCanvasSize / project 反推。
   */
  preferredCanvasPreset: string | null;

  /**
   * 当前选中的 clip id（画布选中编辑用）。
   *
   * - `null`：没有选中任何 clip。
   * - 非 `null`：选中的 clip id，Preview 会显示选中框和编辑控件。
   */
  selectedClipId: string | null;

  /**
   * 时间轴 clip 拖拽时是否启用吸附（吸附到相邻 clip 边界）。
   */
  timelineSnapEnabled: boolean;

  /**
   * 撤销栈（命令模式）。不直接修改，仅通过 undo/redo 与各 action 内部 push 使用。
   */
  historyPast: Command[];

  /**
   * 重做栈。撤销后再次编辑会清空。
   */
  historyFuture: Command[];
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
  /** options.skipHistory 为 true 时仅用于 redo，不压入历史 */
  loadVideoFile(file: File, options?: { skipHistory?: boolean }): Promise<void>;

  /**
   * 导入本地图片文件并写入工程。
   * 行为同 loadVideoFile：已有工程则追加 asset + 新轨道 + 新 clip；无工程则创建新工程。
   * 图片 clip 默认时长 5 秒。
   */
  loadImageFile(file: File, options?: { skipHistory?: boolean }): Promise<void>;

  /**
   * 导入本地音频文件并写入工程。
   * 行为同 loadVideoFile：已有工程则追加 asset + 新音频轨道 + 新 clip；无工程则创建新工程。
   * 音频 clip 时长等于音频文件时长。
   *
   * 副作用：
   * - 会创建 blob URL 并写入 asset.source。
   * - 会更新 `loading`、并重新计算 `duration`。
   */
  loadAudioFile(file: File, options?: { skipHistory?: boolean }): Promise<void>;

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
   * @param skipHistory 为 true 时仅更新颜色不记录 undo 历史（用于颜色选择器拖拽中的实时预览）
   */
  setCanvasBackgroundColor(color: string, skipHistory?: boolean): void;

  /**
   * 设置时间轴吸附开关（clip 拖拽时是否吸附到相邻边界）。
   */
  setTimelineSnapEnabled(enabled: boolean): void;

  /**
   * 设置画布尺寸（width/height）。
   * - 有工程时：更新 project 并支持撤销；
   * - 无工程时：更新 preferredCanvasSize，导入视频时将使用此尺寸。
   * @param preset 预设 value（如 "wechat-video-16:9"），用于比例相同时正确显示选中项
   */
  setCanvasSize(width: number, height: number, preset?: string): void;

  /**
   * 复制指定 clip，新 clip 放在同一轨道的最后一个（紧接在当前轨道末尾之后）。
   * 若 clipId 不存在或轨道不存在则 no-op。
   */
  duplicateClip(clipId: string): void;

  /**
   * 在当前播放头位置将指定 clip 切成两段（左段 [start, currentTime]、右段 [currentTime, end]）。
   * 仅当 currentTime 严格位于该 clip 的 (start, end) 内时生效；否则 no-op。
   */
  cutClip(clipId: string): void;

  /**
   * 从工程中删除指定 clip。
   * 会重新计算 duration，若当前播放时间超过新时长则回退。
   */
  deleteClip(clipId: string): void;

  /**
   * 在播放头位置添加文字片段。默认 5 秒时长，文案为「标题文字」。
   * 无工程时会先创建空工程（使用 preferredCanvasSize）。
   *
   * @param text 初始文案，例如「正文」「标题1」等
   * @param fontSize 可选的初始字号，不传则使用默认字号
   */
  addTextClip(text?: string, fontSize?: number): void;

  /**
   * 在播放头位置添加形状片段。形状以 SVG data URL 作为图片 source，复用图片渲染管线。
   * 默认 5 秒时长，居中显示。
   * 无工程时会先创建空工程（使用 preferredCanvasSize）。
   *
   * @param svgDataUrl 形状的 SVG data URL
   * @param shapeSize 形状的原始宽高（用于 imageMeta 和 contain 缩放）
   * @param name 形状名称（用于 asset.name 和轨道名称）
   */
  addShapeClip(
    svgDataUrl: string,
    shapeSize: { width: number; height: number },
    name?: string,
  ): void;

  /**
   * 在 timeline 立即创建一个 loading 态的占位 clip，并返回创建的 ids。
   * 面板层在需要异步获取资源（fetch 远程 URL）之前调用，让用户立即看到 timeline 响应。
   * 异步完成后通过 resolveMediaPlaceholder 更新 asset 和 clip 的实际信息。
   */
  addMediaPlaceholder(params: {
    name: string;
    kind: "video" | "audio" | "image";
    sourceUrl?: string;
  }): { assetId: string; trackId: string; clipId: string };

  /**
   * 将一个 loading 态的占位 asset/clip 更新为最终状态。
   * 传入 file 后自动 probeMedia 并更新 asset 信息、clip 时长。
   * 如果传入 null 表示加载失败，则回滚移除占位。
   */
  resolveMediaPlaceholder(
    ids: { assetId: string; trackId: string; clipId: string },
    file: File | null,
    options?: { skipHistory?: boolean },
  ): Promise<void>;

  /**
   * 更新指定 clip 的 params（如文本内容的 text、fontSize、fill）。
   * 支持历史记录。
   */
  updateClipParams(clipId: string, params: Record<string, unknown>): void;

  /**
   * 瞬时更新 clip params，不写入历史。用于颜色/不透明度拖动时的实时预览。
   */
  updateClipParamsTransient(
    clipId: string,
    params: Record<string, unknown>,
  ): void;

  /**
   * 将已通过 transient 更新的 params 提交到历史。在拖动/选择结束时调用。
   */
  commitClipParamsChange(
    clipId: string,
    prevParams: Record<string, unknown>,
  ): void;

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
  updateClipTiming(
    clipId: string,
    start: number,
    end: number,
    trackId?: string,
  ): void;

  /**
   * 按拖拽后的新顺序更新轨道 order（时间轴行拖拽结束时调用）。
   * @param orderedTrackIds 从顶到底的轨道 id 顺序
   */
  reorderTracks(orderedTrackIds: string[]): void;

  /**
   * 切换指定轨道的静音状态。
   */
  toggleTrackMuted(trackId: string): void;

  /**
   * 撤销上一步编辑（仅影响 project 相关操作）。
   */
  undo(): void;

  /**
   * 重做最近一次撤销（可能为 async，如添加视频）。
   */
  redo(): void | Promise<void>;

  /** 内部使用：将一条命令压入撤销栈，并清空重做栈。 */
  pushHistory(cmd: Command): void;

  /**
   * 将当前工程导出为 mp4，并返回生成的视频 Blob。
   *
   * - 返回 `null` 表示导出条件不满足（无工程/无资源/无主视频等）。
   * - `onProgress` 取值范围通常为 0~1（由底层 renderer 决定）。
   */
  exportToMp4(onProgress?: (progress: number) => void): Promise<Blob | null>;

  /**
   * 设置当前选中的 clip id（画布选中编辑用）。
   * @param id clip id 或 null 取消选中
   */
  setSelectedClipId(id: string | null): void;

  /**
   * 瞬时更新 clip 变换（如透明度），不写入历史。用于调整面板内拖动时的实时预览。
   */
  updateClipTransformTransient(
    clipId: string,
    transform: { opacity?: number },
  ): void;

  /**
   * 将已通过 transient 更新的 transform 提交到历史。在调整面板关闭时调用。
   */
  commitClipTransformChange(
    clipId: string,
    prevTransform: Record<string, unknown>,
  ): void;

  /**
   * 更新指定 clip 的画布变换属性（位置、缩放、旋转、透明度等）。
   * 用于 Preview 中选中的元素被移动、缩放、旋转后写回工程数据。
   *
   * @param clipId clip id
   * @param transform 变换属性（部分字段，会合并到现有 transform 上）
   */
  updateClipTransform(
    clipId: string,
    transform: {
      x?: number;
      y?: number;
      scaleX?: number;
      scaleY?: number;
      rotation?: number;
      width?: number;
      height?: number;
      opacity?: number;
    },
  ): void;
}

/**
 * ProjectStore：state 与 actions 的组合类型。
 */
export type ProjectStore = ProjectStoreState & ProjectStoreActions;
