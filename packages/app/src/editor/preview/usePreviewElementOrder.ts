import { useEffect, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Project } from "@swiftav/project";

const RENDERABLE_KINDS = ["text", "image", "video"] as const;

/**
 * 按轨道 order 升序收集当前时刻可见的、可渲染的 clip id（从底到顶）。
 * 用于 setElementOrder，保证「上方轨道」显示在「下方轨道」上面。
 */
export function getVisibleClipIdsInTrackOrder(
  project: Project | null,
  currentTime: number,
): string[] {
  if (!project) {
    return [];
  }
  const t = currentTime;
  const ids: string[] = [];
  const tracksByOrder = [...project.tracks].sort((a, b) => a.order - b.order);
  for (const track of tracksByOrder) {
    if (track.hidden) {
      continue;
    }
    for (const clip of track.clips) {
      if (
        !RENDERABLE_KINDS.includes(clip.kind as (typeof RENDERABLE_KINDS)[number])
      ) {
        continue;
      }
      if (clip.start > t || clip.end <= t) {
        continue;
      }
      ids.push(clip.id);
    }
  }
  return ids;
}

/**
 * 同步画布元素叠放顺序为「按轨道 order」：上方轨道在上层。
 * 应在 usePreviewTextSync / usePreviewImageSync / usePreviewVideo 之后执行，
 * 确保节点已加入画布后再调整顺序。
 */
export function usePreviewElementOrder(
  editorRef: RefObject<CanvasEditor | null>,
  project: Project | null,
  currentTime: number,
): void {
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !project) {
      return;
    }
    const ids = getVisibleClipIdsInTrackOrder(project, currentTime);
    editor.setElementOrder(ids);
  }, [editorRef, project, currentTime]);
}
