import { useEffect, useRef, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Project } from "@swiftav/project";

/**
 * 按 currentTime 同步“当前可见”的文本轨道片段到画布。
 * 仅 start <= t < end 的文本 clip 显示；与内部 syncedTextClipIdsRef diff 后 add/update/removeText。
 */
export function usePreviewTextSync(
  editorRef: RefObject<CanvasEditor | null>,
  project: Project | null,
  currentTime: number,
): void {
  const syncedTextClipIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!project) {
      for (const id of syncedTextClipIdsRef.current) {
        editor.removeText(id);
      }
      syncedTextClipIdsRef.current.clear();
      return;
    }

    const t = currentTime;
    const visibleTextClips: Array<{
      id: string;
      text: string;
      x: number;
      y: number;
      fontSize: number;
      fill: string;
    }> = [];

    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        if (clip.kind !== "text" || clip.start > t || clip.end <= t) continue;
        const asset = project.assets.find((a) => a.id === clip.assetId);
        const params = (clip.params ?? {}) as {
          text?: string;
          fontSize?: number;
          fill?: string;
        };
        visibleTextClips.push({
          id: clip.id,
          text: params.text ?? asset?.textMeta?.initialText ?? "",
          x: clip.transform?.x ?? 0,
          y: clip.transform?.y ?? 0,
          fontSize: params.fontSize ?? 32,
          fill: params.fill ?? "#ffffff",
        });
      }
    }

    const visibleIds = new Set(visibleTextClips.map((c) => c.id));
    for (const id of syncedTextClipIdsRef.current) {
      if (!visibleIds.has(id)) {
        editor.removeText(id);
        syncedTextClipIdsRef.current.delete(id);
      }
    }
    for (const clip of visibleTextClips) {
      if (syncedTextClipIdsRef.current.has(clip.id)) {
        editor.updateText(clip.id, {
          text: clip.text,
          x: clip.x,
          y: clip.y,
          fontSize: clip.fontSize,
          fill: clip.fill,
        });
      } else {
        editor.addText({
          id: clip.id,
          text: clip.text,
          x: clip.x,
          y: clip.y,
          fontSize: clip.fontSize,
          fill: clip.fill,
        });
        syncedTextClipIdsRef.current.add(clip.id);
      }
    }
  }, [editorRef, project, currentTime]);
}
