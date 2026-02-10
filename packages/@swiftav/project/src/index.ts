export type ProjectId = string;
export type TrackId = string;
export type ClipId = string;
export type AssetId = string;

export type ClipKind = 'video' | 'audio' | 'image' | 'text';

export interface Asset {
  id: AssetId;
  /**
   * 原始媒体路径或标识（URL、相对路径等）
   */
  source: string;
  kind: 'video' | 'audio' | 'image';
  /**
   * 媒体本身的时长（秒），图片为 0 或 1 视业务而定。
   */
  duration?: number;
  /**
   * 可选的元信息（分辨率、声道数等），由 @swiftav/media 解析后写入。
   */
  meta?: Record<string, unknown>;
}

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
   * 额外参数（透明度、变换、特效 id 等）
   */
  params?: Record<string, unknown>;
}

export interface Track {
  id: TrackId;
  /**
   * 轨道类型：决定该轨道主要承载的内容。
   * 具体约束由上层应用决定，这里仅作标记。
   */
  kind: 'video' | 'audio' | 'mixed';
  name?: string;
  clips: Clip[];
}

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
   * 媒体资源池。
   */
  assets: Asset[];
  /**
   * 时间轴轨道列表。
   */
  tracks: Track[];
}

export interface CreateProjectOptions {
  id: ProjectId;
  name: string;
  fps?: number;
}

export function createEmptyProject(options: CreateProjectOptions): Project {
  const now = new Date().toISOString();
  return {
    id: options.id,
    name: options.name,
    version: 1,
    createdAt: now,
    updatedAt: now,
    fps: options.fps ?? 30,
    assets: [],
    tracks: [],
  };
}

export function addTrack(project: Project, track: Omit<Track, 'clips'> & { clips?: Clip[] }): Project {
  const nextTrack: Track = {
    ...track,
    clips: track.clips ?? [],
  };
  return {
    ...project,
    tracks: [...project.tracks, nextTrack],
    updatedAt: new Date().toISOString(),
  };
}

export function addClip(project: Project, clip: Clip): Project {
  const tracks = project.tracks.map((track) =>
    track.id === clip.trackId
      ? {
          ...track,
          clips: [...track.clips, clip],
        }
      : track,
  );

  return {
    ...project,
    tracks,
    updatedAt: new Date().toISOString(),
  };
}

export interface UpdateClipPatch {
  trackId?: TrackId;
  start?: number;
  end?: number;
  inPoint?: number;
  outPoint?: number;
  params?: Record<string, unknown>;
}

export function updateClip(project: Project, clipId: ClipId, patch: UpdateClipPatch): Project {
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
      ...(patch.params !== undefined && { params: patch.params }),
      ...(patch.trackId !== undefined && { trackId: patch.trackId }),
    };

    const clips = [...track.clips];
    clips[clipIndex] = nextClip;
    updated = true;
    return { ...track, clips };
  });

  // 如果修改了 trackId，需要把 clip 从原轨道移动到新轨道
  if (patch.trackId) {
    const clip = findClipById(project, clipId);
    if (clip && clip.trackId !== patch.trackId) {
      const withoutOld = project.tracks.map((track) =>
        track.id === clip.trackId
          ? { ...track, clips: track.clips.filter((c) => c.id !== clipId) }
          : track,
      );

      tracks = withoutOld.map((track) =>
        track.id === patch.trackId
          ? { ...track, clips: [...track.clips, { ...clip, trackId: patch.trackId }] }
          : track,
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

export function removeClip(project: Project, clipId: ClipId): Project {
  const tracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((c) => c.id !== clipId),
  }));

  return {
    ...project,
    tracks,
    updatedAt: new Date().toISOString(),
  };
}

export function findClipById(project: Project, clipId: ClipId): Clip | undefined {
  for (const track of project.tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) return found;
  }
  return undefined;
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

