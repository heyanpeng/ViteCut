import { useEffect, useRef, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Project } from "@swiftav/project";

/**
 * 根据 currentTime 将“可见”文本片段同步到画布上。
 * 逻辑：仅显示 start <= t < end 的文本片段；通过与内部已同步的文本片段 ID 集合 diff，实现 add/update/remove 操作。
 */
export function usePreviewTextSync(
  editorRef: RefObject<CanvasEditor | null>,
  project: Project | null,
  currentTime: number,
): void {
  // 已同步到画布上的文本 clip id 集合，避免重复 add/remove
  const syncedTextClipIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      // 画布未初始化，无需处理
      return;
    }
    if (!project) {
      // 项目被卸载或未加载，移除所有已同步文本
      for (const id of syncedTextClipIdsRef.current) {
        editor.removeText(id);
      }
      syncedTextClipIdsRef.current.clear();
      return;
    }

    const t = currentTime;
    // 收集当前时间点可见的所有文本 clip 信息
    const visibleTextClips: Array<{
      id: string;
      text: string;
      x: number;
      y: number;
      fontSize: number;
      fill: string;
    }> = [];

    // 遍历工程所有轨道
    for (const track of project.tracks) {
      // 跳过被隐藏的轨道
      if (track.hidden) {
        continue;
      }
      // 遍历轨道的片段
      for (const clip of track.clips) {
        // 仅处理 kind 为 "text" 且在当前时间可见的片段
        if (
          clip.kind !== "text" ||
          clip.start > t || // 尚未开始
          clip.end <= t // 已结束
        ) {
          continue;
        }
        // 找到与 clip 对应的 asset（用于补齐初始文本等信息）
        const asset = project.assets.find((a) => a.id === clip.assetId);

        // 合并参数配置（优先 clip.params，其次 asset.textMeta.initialText）
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

    // 当前帧所有可见文本片段 id 集合
    const visibleIds = new Set(visibleTextClips.map((c) => c.id));
    // step1: 移除当前不可见但上次渲染时存在的文本片段
    for (const id of syncedTextClipIdsRef.current) {
      if (!visibleIds.has(id)) {
        editor.removeText(id);
        syncedTextClipIdsRef.current.delete(id);
      }
    }
    // step2: 按当前 visibleTextClips 添加或更新文本
    for (const clip of visibleTextClips) {
      if (syncedTextClipIdsRef.current.has(clip.id)) {
        // 已存在，更新内容和变换属性（实现拖动/内容动态变化）
        editor.updateText(clip.id, {
          text: clip.text,
          x: clip.x,
          y: clip.y,
          fontSize: clip.fontSize,
          fill: clip.fill,
        });
      } else {
        // 首次出现在可见集，添加到画布
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
