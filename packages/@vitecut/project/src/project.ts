import type { ProjectId, TrackId, ClipId } from "./ids";
import type { Asset } from "./asset";
import type { Clip, UpdateClipPatch } from "./clip";
import type { Track } from "./track";

/**
 * 工程导出相关的配置。
 *
 * 仅描述“期望的导出参数”，具体编码细节由 @vitecut/media 解释。
 */
export interface ProjectExportSettings {
  format?: "mp4" | "webm";
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  audioSampleRate?: number;
  audioChannels?: number;
}

/**
 * 视频工程的顶层数据结构。
 *
 * 描述一个完整工程的基础信息、画布参数、资源池与时间轴。
 */
export interface Project {
  id: ProjectId;
  name: string;
  /**
   * 工程版本号，用于后续做 schema 迁移。
   */
  version: 1;
  createdAt: string;
  updatedAt: string;
  /**
   * 工程目标帧率（导出用），预览可不完全遵循。
   */
  fps: number;
  /**
   * 工程画布 / 导出目标分辨率。
   * 实际渲染时，@vitecut/canvas 可根据该分辨率创建舞台或离屏 canvas。
   */
  width: number;
  height: number;
  /**
   * 画布背景色（CSS 颜色字符串，如 #000000），用于预览与导出。
   */
  backgroundColor?: string;
  /**
   * 导出相关的设置（封装格式、比特率等）。
   * 实际编码细节由 @vitecut/media 解释。
   */
  exportSettings?: ProjectExportSettings;
  /**
   * 媒体资源池。
   */
  assets: Asset[];
  /**
   * 时间轴轨道列表。
   */
  tracks: Track[];
}

/**
 * 创建空工程所需的参数。
 */
export interface CreateProjectOptions {
  id: ProjectId;
  name: string;
  fps?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  exportSettings?: ProjectExportSettings;
}

/**
 * 创建一个空工程。
 *
 * 仅初始化元信息、分辨率与 fps，资源与轨道列表为空。
 */
export function createEmptyProject(options: CreateProjectOptions): Project {
  const now = new Date().toISOString();
  return {
    id: options.id,
    name: options.name,
    version: 1,
    createdAt: now,
    updatedAt: now,
    fps: options.fps ?? 30,
    width: options.width ?? 1920,
    height: options.height ?? 1080,
    backgroundColor: options.backgroundColor ?? "#000000",
    exportSettings: options.exportSettings,
    assets: [],
    tracks: [],
  };
}

/**
 * 向工程中添加一条轨道。
 *
 * 会自动计算轨道的 order（显示顺序）。
 */
export function addTrack(
  project: Project,
  track: Omit<Track, "clips" | "order"> & { clips?: Clip[]; order?: number }
): Project {
  const nextOrder =
    track.order ??
    (project.tracks.length === 0
      ? 0
      : Math.max(...project.tracks.map((t) => t.order)) + 1);

  const nextTrack: Track = {
    ...track,
    order: nextOrder,
    clips: track.clips ?? [],
  };
  return {
    ...project,
    tracks: [...project.tracks, nextTrack],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 向指定轨道添加一个片段。
 */
export function addClip(project: Project, clip: Clip): Project {
  const tracks = project.tracks.map((track) =>
    track.id === clip.trackId
      ? {
          ...track,
          clips: [...track.clips, clip],
        }
      : track
  );

  return {
    ...project,
    tracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 更新指定片段的时间、位置、变换等信息。
 */
export function updateClip(
  project: Project,
  clipId: ClipId,
  patch: UpdateClipPatch
): Project {
  let updated = false;

  let tracks = project.tracks.map((track) => {
    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex === -1) return track;

    const clip = track.clips[clipIndex];
    const nextClip: Clip = {
      ...clip,
      ...(patch.start !== undefined && { start: patch.start }),
      ...(patch.end !== undefined && { end: patch.end }),
      ...(patch.inPoint !== undefined && { inPoint: patch.inPoint }),
      ...(patch.outPoint !== undefined && { outPoint: patch.outPoint }),
      ...(patch.transform !== undefined && { transform: patch.transform }),
      ...(patch.params !== undefined && { params: patch.params }),
      ...(patch.trackId !== undefined && { trackId: patch.trackId }),
    };

    const clips = [...track.clips];
    clips[clipIndex] = nextClip;
    updated = true;
    return { ...track, clips };
  });

  // 如果修改了 trackId，需要把 clip 从原轨道移动到新轨道（使用已应用 patch 的 clip，避免 start/end 丢失）
  if (patch.trackId) {
    const clip = findClipById(project, clipId);
    if (clip && clip.trackId !== patch.trackId) {
      const trackWithUpdated = tracks.find((t) => t.id === clip.trackId);
      const movedClip = trackWithUpdated?.clips.find(
        (c) => c.id === clipId
      ) ?? {
        ...clip,
        trackId: patch.trackId,
      };

      const withoutOld = tracks.map((track) =>
        track.id === clip.trackId
          ? { ...track, clips: track.clips.filter((c) => c.id !== clipId) }
          : track
      );

      tracks = withoutOld.map((track) =>
        track.id === patch.trackId
          ? {
              ...track,
              clips: [...track.clips, { ...movedClip, trackId: patch.trackId }],
            }
          : track
      );
    }
  }

  if (!updated && !patch.trackId) {
    return project;
  }

  return {
    ...project,
    tracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 从工程中移除指定片段。
 * 若移除后该轨道为空，则一并删除该轨道。
 */
export function removeClip(project: Project, clipId: ClipId): Project {
  const tracks = project.tracks
    .map((track) => ({
      ...track,
      clips: track.clips.filter((c) => c.id !== clipId),
    }))
    .filter((track) => track.clips.length > 0);

  return {
    ...project,
    tracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 在工程中查找指定 id 的片段。
 */
export function findClipById(
  project: Project,
  clipId: ClipId
): Clip | undefined {
  for (const track of project.tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) return found;
  }
  return undefined;
}

/**
 * 设置指定轨道的静音状态。
 */
export function setTrackMuted(
  project: Project,
  trackId: TrackId,
  muted: boolean
): Project {
  const tracks = project.tracks.map((track) =>
    track.id === trackId ? { ...track, muted } : track
  );
  return {
    ...project,
    tracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 按拖拽后的新顺序更新轨道 order。
 * @param project 当前工程
 * @param orderedTrackIds 从顶到底的轨道 id 顺序（index 0 = 最上方轨道）
 * @returns 更新 order 后的新工程
 */
export function reorderTracks(
  project: Project,
  orderedTrackIds: TrackId[]
): Project {
  const idToNewOrder = new Map<TrackId, number>();
  const topOrder = orderedTrackIds.length - 1;
  for (let i = 0; i < orderedTrackIds.length; i++) {
    idToNewOrder.set(orderedTrackIds[i], topOrder - i);
  }
  const tracks = project.tracks.map((track) => {
    const order = idToNewOrder.get(track.id);
    if (order === undefined) {
      return track;
    }
    return { ...track, order };
  });
  return {
    ...project,
    tracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 计算工程总时长：所有轨道上 clip.end 的最大值。
 */
export function getProjectDuration(project: Project): number {
  return project.tracks.reduce((max, track) => {
    const trackMax = track.clips.reduce((m, clip) => Math.max(m, clip.end), 0);
    return Math.max(max, trackMax);
  }, 0);
}

/**
 * 序列化工程为 JSON 字符串。
 */
export function serializeProject(project: Project): string {
  return JSON.stringify(project);
}

/**
 * 从 JSON 字符串反序列化为 Project。
 * 未来如果有版本迁移逻辑，可以在这里处理。
 */
export function deserializeProject(json: string): Project {
  const parsed = JSON.parse(json) as Project;
  return parsed;
}
