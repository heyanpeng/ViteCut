import type {
  Project,
  RenderProject,
  RenderAsset,
  RenderTrack,
  RenderClip,
} from "@vitecut/project";
import { getProjectDuration } from "@vitecut/project";

/**
 * 将编辑态的 Project 转换为用于导出/后端渲染的 RenderProject。
 *
 * 说明：
 * - 当前实现主要是结构瘦身与补充 duration，字段基本一一映射；
 * - 资源的 source 直接透传，素材在添加时已通过 /api/media 上传为 HTTP URL，
 *   导出时无需再做 blob 上传。
 */
export function projectToRenderProject(project: Project): RenderProject {
  const duration = getProjectDuration(project);

  const assets: RenderAsset[] = project.assets.map((asset) => ({
    id: asset.id,
    source: asset.source,
    kind: asset.kind,
    duration: asset.duration,
    videoMeta: asset.videoMeta,
    audioMeta: asset.audioMeta,
    imageMeta: asset.imageMeta,
    textMeta: asset.textMeta,
  }));

  const tracks: RenderTrack[] = project.tracks.map((track) => {
    const clips: RenderClip[] = track.clips.map((clip) => ({
      id: clip.id,
      trackId: clip.trackId,
      assetId: clip.assetId,
      kind: clip.kind,
      start: clip.start,
      end: clip.end,
      inPoint: clip.inPoint,
      outPoint: clip.outPoint,
      transform: clip.transform,
      params: clip.params,
    }));

    return {
      id: track.id,
      kind: track.kind,
      name: track.name,
      order: track.order,
      muted: track.muted,
      hidden: track.hidden,
      clips,
    };
  });

  const renderProject: RenderProject = {
    id: project.id,
    name: project.name,
    version: project.version,
    fps: project.fps,
    width: project.width,
    height: project.height,
    backgroundColor: project.backgroundColor,
    duration,
    exportSettings: project.exportSettings,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    assets,
    tracks,
  };

  return renderProject;
}
