import type { Clip, Project } from "@swiftav/project";

export type Track = Project["tracks"][number];

export type ActiveClipEntry = {
  clip: Clip;
  track: Track;
  asset: { id: string; source: string };
};

export type ActiveVideoClip = ActiveClipEntry;
export type ActiveAudioClip = ActiveClipEntry;

/**
 * 获取当前时间下可见的视频片段。
 * 仅包含 kind 为 video、时间区间 [start, end) 包含 t、且轨道未隐藏的 clip。
 * 当 t 等于 timelineDuration（Go to End）时，也包含 end === duration 的 clip，用于显示最后一帧。
 * @param project 当前工程
 * @param t 当前时间（秒）
 * @param timelineDuration 时间轴总时长（可选），用于在 t === duration 时仍显示结束于末尾的 clip
 * @returns 可见片段的 clip、track、asset（id + source）列表
 */
export function getActiveVideoClips(
  project: Project,
  t: number,
  timelineDuration?: number,
): ActiveVideoClip[] {
  const out: ActiveVideoClip[] = [];
  const tracksByOrder = [...project.tracks].sort((a, b) => a.order - b.order);
  const atEnd =
    timelineDuration != null &&
    timelineDuration > 0 &&
    t >= timelineDuration;
  for (const track of tracksByOrder) {
    if (track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.kind !== "video") continue;
      const inRange = clip.start <= t && clip.end > t;
      const endFrame =
        atEnd && clip.start < clip.end && clip.end >= timelineDuration!;
      if (!inRange && !endFrame) continue;
      const asset = project.assets.find((a) => a.id === clip.assetId);
      if (!asset || asset.kind !== "video" || !asset.source) continue;
      out.push({ clip, track, asset: { id: asset.id, source: asset.source } });
    }
  }
  return out;
}

/**
 * 获取当前时间下活跃的音频片段（独立音频 clip，不含视频中的音轨）。
 * 仅包含 kind 为 audio、时间区间 [start, end) 包含 t 的 clip。
 * 注意：不过滤 track.muted，静音由播放层 GainNode 控制（gain 设为 0）。
 * @param project 当前工程
 * @param t 当前时间（秒）
 * @param timelineDuration 时间轴总时长（可选）
 * @returns 活跃音频片段的 clip、track、asset（id + source）列表
 */
export function getActiveAudioClips(
  project: Project,
  t: number,
  timelineDuration?: number,
): ActiveAudioClip[] {
  const out: ActiveAudioClip[] = [];
  const tracksByOrder = [...project.tracks].sort((a, b) => a.order - b.order);
  const atEnd =
    timelineDuration != null &&
    timelineDuration > 0 &&
    t >= timelineDuration;
  for (const track of tracksByOrder) {
    for (const clip of track.clips) {
      if (clip.kind !== "audio") continue;
      const inRange = clip.start <= t && clip.end > t;
      const endFrame =
        atEnd && clip.start < clip.end && clip.end >= timelineDuration!;
      if (!inRange && !endFrame) continue;
      const asset = project.assets.find((a) => a.id === clip.assetId);
      if (!asset || asset.kind !== "audio" || !asset.source) continue;
      out.push({ clip, track, asset: { id: asset.id, source: asset.source } });
    }
  }
  return out;
}
