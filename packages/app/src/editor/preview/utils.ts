import type { Clip, Project } from "@swiftav/project";

export type Track = Project["tracks"][number];

export type ActiveVideoClip = {
  clip: Clip;
  track: Track;
  asset: { id: string; source: string };
};

/**
 * 获取当前时间下可见的视频片段。
 * 仅包含 kind 为 video、时间区间 [start, end) 包含 t、且轨道未隐藏的 clip，按轨道顺序返回。
 * @param project 当前工程
 * @param t 当前时间（秒）
 * @returns 可见片段的 clip、track、asset（id + source）列表
 */
export function getActiveVideoClips(
  project: Project,
  t: number,
): ActiveVideoClip[] {
  const out: ActiveVideoClip[] = [];
  for (const track of project.tracks) {
    if (track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.kind !== "video" || clip.start > t || clip.end <= t) continue;
      const asset = project.assets.find((a) => a.id === clip.assetId);
      if (!asset || asset.kind !== "video" || !asset.source) continue;
      out.push({ clip, track, asset: { id: asset.id, source: asset.source } });
    }
  }
  return out;
}
